import requests
import json

url = "https://api.neero.tech/payment-gateway/api/v1/payment-methods"

payload = json.dumps({
  "type": "",
  "mobileMoneyDetails": {
    "phoneNumber": "+237678877898",
    "countryIso": "CM",
    "mobileMoneyProvider": "MTN_MONEY"
  },
  "neeroMerchantDetails": {
    "merchantKey": "string",
    "storeId": "string",
    "balanceId": "string",
    "operatorId": None
  },
  "personDetails": {
    "personId": 1,
    "accountId": "string",
    "paymentRequestId": None
  },
  "personDetailsWithPhoneNumber": {
    "countryCode": "CM",
    "phoneNumber": "698223844"
  },
  "recieverDetails":{
    "phoneNumber":"681475063",
    "countryCode": "CM"
  },
  "paypalDetails": {
    "email": "florian.Lowe344@gmail.com",
    "countryIso": "FR"
  }
})

headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer sk_0c2ba3aa5aa81af4039837e133be7d0849acda6c3a5541da'  # Add this line
}

response = requests.request("POST", url, headers=headers, data=payload)

print(response.status_code)
print(response.text)