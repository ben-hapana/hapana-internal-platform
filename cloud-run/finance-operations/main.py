"""
Cloud Run Finance Operations Processor
Receives CSV file references and executes finance scripts
MOCKED VERSION - Returns success responses without calling Stripe API
"""

import os
import json
import logging
import subprocess
import tempfile
import requests
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from google.cloud import storage, firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize Google Cloud clients
storage_client = storage.Client()
firestore_client = firestore.Client()

def download_file_from_storage(file_reference):
    """Download file from Cloud Storage"""
    try:
        bucket_name = os.environ.get('STORAGE_BUCKET')
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_reference['storagePath'])
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(mode='w+', suffix='.csv', delete=False)
        blob.download_to_filename(temp_file.name)
        
        logger.info(f"Downloaded file to {temp_file.name}")
        return temp_file.name
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        raise

def upload_result_to_storage(file_path, execution_id):
    """Upload result file to Cloud Storage"""
    try:
        bucket_name = os.environ.get('STORAGE_BUCKET')
        bucket = storage_client.bucket(bucket_name)
        
        # Generate result file path
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        blob_path = f"finance-operations/results/{execution_id}_{timestamp}_result.csv"
        blob = bucket.blob(blob_path)
        
        # Upload file
        blob.upload_from_filename(file_path)
        
        # Get download URL
        download_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.now() + timedelta(days=7),  # 7 day expiry
            method="GET"
        )
        
        return {
            'storagePath': blob_path,
            'downloadUrl': download_url,
            'filename': f"{execution_id}_{timestamp}_result.csv",
            'originalName': f"result_{timestamp}.csv",
            'size': os.path.getsize(file_path)
        }
    except Exception as e:
        logger.error(f"Error uploading result: {e}")
        raise

def execute_script(script_path, input_file_path, execution_id):
    """Execute the finance script"""
    try:
        logger.info(f"Executing script: {script_path} (MOCKED)")
        
        # Prepare script execution
        script_dir = "/app/scripts"  # Scripts directory in container
        full_script_path = os.path.join(script_dir, script_path)
        
        if not os.path.exists(full_script_path):
            raise FileNotFoundError(f"Script not found: {full_script_path}")
        
        # Prepare environment variables for the script
        env = os.environ.copy()
        env['INPUT_CSV_PATH'] = input_file_path
        env['EXECUTION_ID'] = execution_id
        
        # Execute the script
        result = subprocess.run(
            ['python', full_script_path],
            cwd=script_dir,
            env=env,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            logger.info("Script executed successfully (MOCKED)")
            return {
                'success': True,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode
            }
        else:
            logger.error(f"Script failed with return code {result.returncode}")
            return {
                'success': False,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode
            }
            
    except subprocess.TimeoutExpired:
        logger.error("Script execution timed out")
        return {
            'success': False,
            'error': 'Script execution timed out after 5 minutes'
        }
    except Exception as e:
        logger.error(f"Error executing script: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def send_webhook_notification(callback_url, execution_id, status, results):
    """Send completion notification back to the main application"""
    try:
        webhook_secret = os.environ.get('WEBHOOK_SECRET')
        
        payload = {
            'executionId': execution_id,
            'status': status,
            'results': results,
            'timestamp': datetime.now().isoformat()
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {webhook_secret}'
        }
        
        response = requests.post(callback_url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            logger.info("Webhook notification sent successfully")
        else:
            logger.error(f"Webhook notification failed: {response.status_code}")
            
    except Exception as e:
        logger.error(f"Error sending webhook notification: {e}")

@app.route('/process', methods=['POST'])
def process_finance_operation():
    """Main endpoint for processing finance operations"""
    try:
        # Parse request
        data = request.get_json()
        execution_id = data.get('executionId')
        operation_id = data.get('operationId')
        script_path = data.get('scriptPath')
        file_reference = data.get('fileReference')
        callback_url = data.get('callbackUrl')
        
        logger.info(f"Processing execution {execution_id} with script {script_path} (MOCKED)")
        
        # Download input file
        input_file_path = download_file_from_storage(file_reference)
        
        # Execute the script
        script_result = execute_script(script_path, input_file_path, execution_id)
        
        # Parse results
        if script_result['success']:
            # Look for result file (script should generate result.csv)
            result_file_path = os.path.join('/tmp', 'result.csv')
            output_files = []
            
            if os.path.exists(result_file_path):
                # Upload result file
                result_file_ref = upload_result_to_storage(result_file_path, execution_id)
                output_files.append(result_file_ref)
            
            # Parse stdout for metrics (expected JSON format)
            try:
                # Try to parse JSON from stdout
                if script_result['stdout'].strip():
                    metrics = json.loads(script_result['stdout'].strip().split('\n')[-1])
                else:
                    metrics = {}
            except:
                metrics = {}
            
            # Enhanced message for mocked responses
            success_message = 'Processing completed successfully'
            if metrics.get('mocked'):
                success_message += ' (MOCKED - No real Stripe API calls made)'
            
            results = {
                'success': True,
                'message': success_message,
                'recordsProcessed': metrics.get('recordsProcessed', 0),
                'recordsSuccessful': metrics.get('recordsSuccessful', 0),
                'recordsFailed': metrics.get('recordsFailed', 0),
                'totalAmount': metrics.get('totalAmount'),
                'currency': metrics.get('currency'),
                'mocked': metrics.get('mocked', False),
                'note': metrics.get('note'),
                'data': metrics,
                'outputFiles': output_files
            }
            
            status = 'completed'
        else:
            results = {
                'success': False,
                'message': 'Processing failed',
                'errors': [script_result.get('error', 'Unknown error')],
                'data': {
                    'stdout': script_result.get('stdout', ''),
                    'stderr': script_result.get('stderr', ''),
                    'returncode': script_result.get('returncode')
                }
            }
            status = 'failed'
        
        # Send webhook notification
        if callback_url:
            send_webhook_notification(callback_url, execution_id, status, results)
        
        # Clean up temporary files
        try:
            os.unlink(input_file_path)
            if os.path.exists('/tmp/result.csv'):
                os.unlink('/tmp/result.csv')
        except:
            pass
        
        return jsonify({
            'success': True,
            'executionId': execution_id,
            'status': status,
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error processing finance operation: {e}")
        
        # Send failure notification
        if 'callback_url' in locals() and 'execution_id' in locals():
            send_webhook_notification(
                callback_url, 
                execution_id, 
                'failed', 
                {
                    'success': False,
                    'message': f'Processing error: {str(e)}',
                    'errors': [str(e)]
                }
            )
        
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'finance-operations-processor',
        'version': 'mocked'
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port) 