targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Globally unique App Service name. Defaults to a stable name per resource group.')
param appName string = 'pneumoscope-${uniqueString(resourceGroup().id)}'

@description('Azure Container Registry name. Must be globally unique and contain only lowercase letters and numbers.')
param acrName string = take('pneumo${uniqueString(resourceGroup().id)}', 50)

@description('Docker repository name inside Azure Container Registry.')
param imageName string = 'pneumoscope'

@description('Initial Docker image tag configured on the App Service. The GitHub workflow updates this to the commit SHA after building.')
param imageTag string = 'latest'

@description('App Service Plan SKU. TensorFlow generally needs more memory than a free/shared plan provides.')
param appServiceSkuName string = 'P1v3'

@description('App Service Plan SKU tier.')
param appServiceSkuTier string = 'PremiumV3'

@secure()
@description('Private HTTPS URL for best_model_auc.keras, such as an Azure Blob SAS URL. Leave blank until the model artifact is available.')
param modelUrl string = ''

var containerPort = '8080'
var fullImageName = '${acr.properties.loginServer}/${imageName}:${imageTag}'
var acrPullRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  kind: 'linux'
  sku: {
    name: appServiceSkuName
    tier: appServiceSkuTier
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${fullImageName}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      ftpsState: 'Disabled'
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: containerPort
        }
        {
          name: 'PORT'
          value: containerPort
        }
        {
          name: 'API_PORT'
          value: containerPort
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'true'
        }
        {
          name: 'WEBSITES_CONTAINER_START_TIME_LIMIT'
          value: '1800'
        }
        {
          name: 'PYTHON_BIN'
          value: '/opt/venv/bin/python'
        }
        {
          name: 'MODEL_PATH'
          value: '/home/site/wwwroot/model-artifacts/best_model_auc.keras'
        }
        {
          name: 'WEB_DIST_PATH'
          value: '/app/apps/api/public'
        }
        {
          name: 'MAX_UPLOAD_BYTES'
          value: '10485760'
        }
        {
          name: 'MODEL_URL'
          value: modelUrl
        }
      ]
    }
  }
}

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, webApp.id, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}

output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output imageRepository string = imageName
