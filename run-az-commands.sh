topicName="mory-order-events"
resourceGroup="serverless-order-rg"

endpoint=$(az eventgrid topic show \
  --name $topicName \
  --resource-group $resourceGroup \
  --query "endpoint" \
  --output tsv)

key=$(az eventgrid topic key list \
  --name $topicName \
  --resource-group $resourceGroup \
  --query "key1" \
  --output tsv)

event='[
  {
    "id": "test-order-001",
    "eventType": "OrderProcessed",
    "subject": "orders/test-order-001",
    "eventTime": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "data": {
      "orderId": "test-order-001",
      "status": "Processed",
      "correlationId": "manual-test-001",
      "email": "test@example.com"
    },
    "dataVersion": "1.0"
  }
]'

curl -X POST "$endpoint" \
  -H "Content-Type: application/json" \
  -H "aeg-sas-key: $key" \
  -d "$event"
