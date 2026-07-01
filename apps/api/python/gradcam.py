import base64
import io

import cv2
import numpy as np
import tensorflow as tf
from PIL import Image


def generate_gradcam(model, image_batch: np.ndarray) -> str:
    resnet = model.get_layer("resnet50")
    target_layer = resnet.get_layer("conv5_block3_out")
    resnet_grad_model = tf.keras.models.Model(resnet.inputs, [target_layer.output, resnet.output])
    flatten = model.get_layer("flatten")
    dense = model.get_layer("dense")
    output_dense = model.get_layer("dense_1")

    with tf.GradientTape() as tape:
        conv_outputs, features = resnet_grad_model(image_batch, training=False)
        x = flatten(features)
        x = dense(x)
        predictions = output_dense(x)
        loss = predictions[:, 0]

    grads = tape.gradient(loss, conv_outputs)
    if grads is None:
        raise RuntimeError("Gradients were not available for the selected activation layer.")

    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    conv_outputs = conv_outputs[0]
    heatmap = tf.squeeze(conv_outputs @ pooled_grads[..., tf.newaxis])
    heatmap = tf.maximum(heatmap, 0)
    max_value = tf.reduce_max(heatmap)
    if float(max_value) == 0:
        heatmap = tf.zeros_like(heatmap)
    else:
        heatmap = heatmap / max_value

    base_image = np.uint8(np.clip(image_batch[0] * 255.0, 0, 255))
    heatmap_np = cv2.resize(heatmap.numpy(), (base_image.shape[1], base_image.shape[0]))
    heatmap_np = np.uint8(255 * heatmap_np)
    color_map = cv2.applyColorMap(heatmap_np, cv2.COLORMAP_JET)
    color_map = cv2.cvtColor(color_map, cv2.COLOR_BGR2RGB)
    overlay = np.uint8(np.clip(color_map * 0.42 + base_image * 0.58, 0, 255))

    output = Image.fromarray(overlay)
    buffer = io.BytesIO()
    output.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")
