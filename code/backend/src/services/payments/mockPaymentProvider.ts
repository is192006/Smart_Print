import { generateReference } from '../../utils/transactionId';
import {
  ConfirmPaymentParams,
  ConfirmPaymentResult,
  ConfirmRefundParams,
  ConfirmRefundResult,
  InitiatePaymentParams,
  InitiatePaymentResult,
  InitiateRefundParams,
  InitiateRefundResult,
  PaymentProvider,
} from './paymentProvider';

// Development/testing-only stand-in for a real payment gateway. Never
// contacts a network, never charges anything real. Every method is
// deterministic: an outcome is decided immediately and synchronously,
// rather than settling asynchronously via a webhook the way a real
// provider would - callers that need to exercise both the success and
// failure paths pass `simulateOutcome` explicitly; it defaults to SUCCESS
// so the common case ("just pay") works with no extra input.
class MockPaymentProvider implements PaymentProvider {
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    void params;
    return { providerReference: generateReference('TXN') };
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResult> {
    return { outcome: params.simulateOutcome ?? 'SUCCESS' };
  }

  async initiateRefund(params: InitiateRefundParams): Promise<InitiateRefundResult> {
    void params;
    return { providerReference: generateReference('RFD') };
  }

  async confirmRefund(params: ConfirmRefundParams): Promise<ConfirmRefundResult> {
    return { outcome: params.simulateOutcome ?? 'SUCCESS' };
  }
}

// Single shared instance - payment.service.ts / refund.service.ts import
// this, not the class, so swapping in a real provider later is a one-line
// change at this export rather than a change at every call site.
export const paymentProvider: PaymentProvider = new MockPaymentProvider();
