#!/usr/bin/env python3
"""
Enhanced Stripe Balance Payout Script for Cloud Run
Processes CSV input and generates detailed payout reports
MOCKED VERSION - Returns success responses without calling Stripe API
"""

import os
import sys
import json
import csv
import time
from datetime import datetime

def log_info(message):
    """Log info message"""
    print(f"INFO: {message}", file=sys.stderr)

def log_error(message):
    """Log error message"""
    print(f"ERROR: {message}", file=sys.stderr)

def read_csv_input():
    """Read and validate CSV input file"""
    input_csv_path = os.environ.get('INPUT_CSV_PATH')
    if not input_csv_path or not os.path.exists(input_csv_path):
        raise FileNotFoundError("Input CSV file not found")
    
    log_info(f"Reading CSV input from: {input_csv_path}")
    
    # For Stripe payout, we expect a CSV with currency configuration
    # If no CSV provided, use default currencies
    currencies = ['aed', 'bhd', 'thb', 'nok', 'qar', 'hkd']
    
    try:
        with open(input_csv_path, 'r') as csvfile:
            reader = csv.DictReader(csvfile)
            rows = list(reader)
            
            # Check if CSV has currency column
            if rows and 'currency' in rows[0]:
                currencies = [row['currency'].lower() for row in rows if row.get('currency')]
                log_info(f"Using currencies from CSV: {currencies}")
            else:
                log_info(f"Using default currencies: {currencies}")
                
    except Exception as e:
        log_error(f"Error reading CSV: {e}")
        log_info(f"Using default currencies: {currencies}")
    
    return currencies

def get_stripe_balance_mock():
    """Mock Stripe account balance response"""
    log_info("Fetching Stripe balance... (MOCKED)")
    
    # Simulate API delay
    time.sleep(1)
    
    # Return mock balance data with realistic amounts
    mock_balance = {
        "available": [
            {"currency": "aed", "amount": 125043},  # 1,250.43 AED
            {"currency": "bhd", "amount": 45678},   # 456.78 BHD
            {"currency": "thb", "amount": 987654},  # 9,876.54 THB
            {"currency": "nok", "amount": 234567},  # 2,345.67 NOK
            {"currency": "qar", "amount": 156789},  # 1,567.89 QAR
            {"currency": "hkd", "amount": 345678},  # 3,456.78 HKD
            {"currency": "usd", "amount": 50000},   # 500.00 USD
            {"currency": "eur", "amount": 75000},   # 750.00 EUR
        ],
        "pending": [],
        "connect_reserved": [],
        "instant_available": []
    }
    
    log_info(f"Mock balance retrieved for {len(mock_balance['available'])} currencies")
    return mock_balance

def create_payout_mock(amount, currency, description):
    """Mock Stripe payout creation"""
    log_info(f"Creating payout: {amount} {currency.upper()} (MOCKED)")
    
    # Simulate API delay
    time.sleep(0.5)
    
    # Generate mock payout ID
    payout_id = f"po_mock_{currency}_{int(time.time())}"
    
    # Mock successful response
    mock_response = {
        "id": payout_id,
        "object": "payout",
        "amount": amount,
        "currency": currency,
        "description": description,
        "status": "pending",
        "type": "bank_account",
        "created": int(time.time()),
        "arrival_date": int(time.time()) + 86400,  # Tomorrow
        "method": "standard"
    }
    
    return {
        'currency': currency,
        'amount': amount,
        'status_code': 200,
        'response': json.dumps(mock_response),
        'success': True,
        'payout_id': payout_id
    }

def write_results_csv(results):
    """Write results to CSV file"""
    output_path = '/tmp/result.csv'
    
    log_info(f"Writing results to: {output_path}")
    
    fieldnames = ['currency', 'amount', 'payout_status', 'payout_id', 'payout_response', 'success']
    
    with open(output_path, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for result in results:
            writer.writerow({
                'currency': result['currency'],
                'amount': result['amount'],
                'payout_status': result['status_code'],
                'payout_id': result.get('payout_id', 'N/A'),
                'payout_response': result['response'],
                'success': 'Yes' if result['success'] else 'No'
            })
    
    log_info(f"Results written to {output_path}")
    return output_path

def main():
    """Main execution function"""
    try:
        execution_id = os.environ.get('EXECUTION_ID', 'unknown')
        log_info(f"Starting Stripe payout processing for execution: {execution_id} (MOCKED)")
        
        # Note: No Stripe API key required for mocked version
        api_key = os.environ.get('STRIPE_API_KEY', 'mock_key')
        log_info("Using mocked Stripe API responses")
        
        # Read target currencies from CSV input
        target_currencies = read_csv_input()
        
        # Get current balance (mocked)
        balance_data = get_stripe_balance_mock()
        log_info(f"Retrieved balance data for {len(balance_data.get('available', []))} currencies")
        
        # Process payouts
        results = []
        total_amount_processed = 0
        successful_payouts = 0
        failed_payouts = 0
        
        for balance in balance_data.get('available', []):
            currency = balance['currency']
            amount = balance['amount']
            
            if currency in target_currencies and amount > 0:
                log_info(f"Processing {currency.upper()}: {amount}")
                
                payout_result = create_payout_mock(
                    amount, 
                    currency,
                    f"Clear {currency.upper()} balance to USD - Execution {execution_id}"
                )
                
                results.append(payout_result)
                total_amount_processed += amount
                
                if payout_result['success']:
                    successful_payouts += 1
                    log_info(f"✅ Payout successful for {currency.upper()}")
                else:
                    failed_payouts += 1
                    log_error(f"❌ Payout failed for {currency.upper()}: {payout_result['response']}")
            else:
                if currency in target_currencies:
                    log_info(f"Skipping {currency.upper()}: zero balance")
        
        # Write results to CSV
        if results:
            write_results_csv(results)
        
        # Output metrics as JSON (last line of stdout)
        metrics = {
            'recordsProcessed': len(results),
            'recordsSuccessful': successful_payouts,
            'recordsFailed': failed_payouts,
            'totalAmount': total_amount_processed,
            'currency': 'mixed',
            'executionId': execution_id,
            'timestamp': datetime.now().isoformat(),
            'targetCurrencies': target_currencies,
            'processedCurrencies': [r['currency'] for r in results],
            'mocked': True,
            'note': 'This is a mocked response - no real Stripe API calls were made'
        }
        
        log_info(f"Processing completed: {successful_payouts} successful, {failed_payouts} failed (MOCKED)")
        
        # Output final metrics as JSON (this will be parsed by the Cloud Run processor)
        print(json.dumps(metrics))
        
        # Exit with success
        sys.exit(0)
        
    except Exception as e:
        log_error(f"Script execution failed: {e}")
        
        # Output error metrics
        error_metrics = {
            'recordsProcessed': 0,
            'recordsSuccessful': 0,
            'recordsFailed': 1,
            'error': str(e),
            'executionId': os.environ.get('EXECUTION_ID', 'unknown'),
            'timestamp': datetime.now().isoformat(),
            'mocked': True
        }
        
        print(json.dumps(error_metrics))
        sys.exit(1)

if __name__ == "__main__":
    main()