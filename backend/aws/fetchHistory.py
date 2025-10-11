import boto3
import json
from datetime import datetime
from decimal import Decimal

# --- Setup clients ---
region = "us-east-1"

dynamodb = boto3.resource("dynamodb", region_name=region)

# DynamoDB table
table = dynamodb.Table("userhistory")

def convert_decimals(obj):
    """Convert DynamoDB Decimal objects to regular Python types"""
    if isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_decimals(value) for key, value in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj) if obj % 1 else int(obj)
    else:
        return obj

def get_all_chat_ids_for_user(user_id):
    """Get all chat IDs for a specific user"""
    try:
        response = table.query(
            KeyConditionExpression='userId = :uid',
            ExpressionAttributeValues={
                ':uid': user_id
            },
            ProjectionExpression='chatId, lastUpdated'
        )
        
        chat_list = []
        for item in response['Items']:
            chat_info = {
                'chatId': item['chatId'],
                'lastUpdated': item.get('lastUpdated', '')
            }
            chat_list.append(chat_info)
        
        # Sort by lastUpdated (most recent first)
        chat_list.sort(key=lambda x: x.get('lastUpdated', ''), reverse=True)
        
        return chat_list
        
    except Exception as e:
        print(f"Error retrieving chat IDs for user {user_id}: {e}")
        return []

def get_specific_chat_history(user_id, chat_id):
    """Get specific chat history for user+chat combination"""
    try:
        response = table.get_item(
            Key={
                'userId': user_id,
                'chatId': chat_id
            }
        )
        
        if 'Item' in response:
            item = response['Item']
            return {
                'userId': user_id,
                'chatId': chat_id,
                'chathistory': convert_decimals(item.get('chathistory', [])),
                'lastUpdated': item.get('lastUpdated', '')
            }
        else:
            return None
            
    except Exception as e:
        print(f"Error retrieving chat history for user {user_id}, chat {chat_id}: {e}")
        return None

def lambda_handler(event, context):
    """
    Lambda handler function for fetching chat history
    Expected payload:
    {
      "userId": "userid",
      "chatId": "chatid/all"
    }
    
    If chatId is "all", returns list of all chatIds for the user
    Otherwise, returns the specific chat history
    """
    
    try:
        # Parse the payload
        if isinstance(event, str):
            event = json.loads(event)
        
        user_id = event.get('userId')
        chat_id = event.get('chatId')
        
        # Validate required fields
        if not all([user_id, chat_id]):
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Missing required fields: userId or chatId'
                })
            }
        
        # Check if requesting all chat IDs
        if chat_id.lower() == "all":
            # Return list of all chat IDs for the user
            chat_list = get_all_chat_ids_for_user(user_id)
            
            response_body = {
                'userId': user_id,
                'chatList': chat_list,
                'totalChats': len(chat_list)
            }
            
        else:
            # Return specific chat history
            chat_history = get_specific_chat_history(user_id, chat_id)
            
            if chat_history is None:
                return {
                    'statusCode': 404,
                    'body': json.dumps({
                        'error': f'Chat history not found for userId: {user_id}, chatId: {chat_id}'
                    })
                }
            
            response_body = chat_history
        
        return {
            'statusCode': 200,
            'body': json.dumps(response_body)
        }
        
    except Exception as e:
        print(f"Error in lambda_handler: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': f'Internal server error: {str(e)}'
            })
        }