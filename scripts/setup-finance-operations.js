/**
 * Setup script for Finance Operations
 * Initializes the database with default operations
 */

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const app = initializeApp({
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

const db = getFirestore(app);

async function setupFinanceOperations() {
  console.log('🚀 Setting up Finance Operations...');

  try {
    // Create Stripe Balance Payout operation
    const stripeOperation = {
      name: 'Stripe Balance Payout',
      description: 'Process Stripe balance payouts for multiple currencies. Converts foreign currency balances to USD and generates detailed payout reports.',
      scriptPath: 'stripe_balance_payout.py',
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const operationRef = await db.collection('finance_operations').add(stripeOperation);
    console.log('✅ Created Stripe Balance Payout operation:', operationRef.id);

    // Create additional sample operations for future use
    const reconciliationOperation = {
      name: 'Bank Reconciliation',
      description: 'Reconcile bank statements with internal financial records. Identifies discrepancies and generates reconciliation reports.',
      scriptPath: 'bank_reconciliation.py',
      status: 'inactive', // Not yet implemented
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const reconciliationRef = await db.collection('finance_operations').add(reconciliationOperation);
    console.log('✅ Created Bank Reconciliation operation:', reconciliationRef.id);

    const payrollOperation = {
      name: 'Payroll Processing',
      description: 'Process payroll data and generate payment files for multiple currencies and payment methods.',
      scriptPath: 'payroll_processing.py',
      status: 'inactive', // Not yet implemented
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const payrollRef = await db.collection('finance_operations').add(payrollOperation);
    console.log('✅ Created Payroll Processing operation:', payrollRef.id);

    console.log('\n🎉 Finance Operations setup completed successfully!');
    console.log('\nAvailable operations:');
    console.log('- Stripe Balance Payout (Active)');
    console.log('- Bank Reconciliation (Inactive)');
    console.log('- Payroll Processing (Inactive)');
    
    console.log('\nNext steps:');
    console.log('1. Deploy the Cloud Run function');
    console.log('2. Configure environment variables');
    console.log('3. Test with a sample CSV file');

  } catch (error) {
    console.error('❌ Error setting up Finance Operations:', error);
    process.exit(1);
  }
}

// Run the setup
setupFinanceOperations()
  .then(() => {
    console.log('\n✨ Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }); 