import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

from preprocessing import preprocess_image, probability_to_label


class PreprocessingTests(unittest.TestCase):
    def test_preprocess_image_shape_and_range(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            image_path = Path(temp_dir) / "xray.png"
            Image.new("L", (32, 24), color=128).save(image_path)

            batch = preprocess_image(image_path)

            self.assertEqual(batch.shape, (1, 512, 512, 3))
            self.assertEqual(batch.dtype, np.float32)
            self.assertGreaterEqual(float(batch.min()), 0.0)
            self.assertLessEqual(float(batch.max()), 1.0)

    def test_probability_to_label_uses_strict_threshold(self) -> None:
        self.assertEqual(probability_to_label(0.62, 0.61), "Pneumonia")
        self.assertEqual(probability_to_label(0.61, 0.61), "Normal")


if __name__ == "__main__":
    unittest.main()
