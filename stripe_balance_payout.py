import requests
import csv

def main():
    api_key = input("Enter your Stripe API Key: ").strip()
    
    # Step 1: Get balance
    balance_response = requests.get(
        'https://api.stripe.com/v1/balance',
        auth=(api_key, '')
    )

    if balance_response.status_code != 200:
        print("Error fetching balance:", balance_response.text)
        return

    balance_data = balance_response.json()

    target_currencies = ['aed', 'bhd', 'thb', 'nok', 'qar', 'hkd']
    results = []

    for bal in balance_data.get('available', []):
        currency = bal['currency']
        amount = bal['amount']

        if currency in target_currencies and amount > 0:
            payout_response = requests.post(
                'https://api.stripe.com/v1/payouts',
                auth=(api_key, ''),
                data={
                    'amount': amount,
                    'currency': currency,
                    'description': f"Clear {currency.upper()} balance to USD"
                }
            )

            payout_result = {
                'currency': currency,
                'amount': amount,
                'payout_status': payout_response.status_code,
                'payout_response': payout_response.text
            }

            results.append(payout_result)

    # Step 4: Write results to CSV
    with open('payout_results.csv', 'w', newline='') as csvfile:
        fieldnames = ['currency', 'amount', 'payout_status', 'payout_response']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for row in results:
            writer.writerow(row)

    print("Process completed. Results saved to payout_results.csv")

if __name__ == "__main__":
    main()
