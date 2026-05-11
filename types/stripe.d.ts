// Local type shim for stripe — full types provided by the stripe npm package on Vercel.
// This file silences the "cannot find module 'stripe'" error in local tsc checks.
declare module 'stripe' {
  class Stripe {
    constructor(key: string, opts?: { apiVersion?: string });
    accounts: {
      create(data: any): Promise<any>;
      retrieve(id: string, opts?: any): Promise<any>;
      update(id: string, data: any): Promise<any>;
    };
    accountLinks: {
      create(data: any): Promise<{ url: string; expires_at: number }>;
    };
    products: {
      create(data: any, opts?: any): Promise<any>;
      retrieve(id: string, opts?: any): Promise<any>;
    };
    prices: {
      create(data: any, opts?: any): Promise<any>;
      retrieve(id: string, opts?: any): Promise<any>;
    };
    paymentLinks: {
      create(data: any, opts?: any): Promise<any>;
      list(data?: any, opts?: any): Promise<{ data: any[] }>;
      listLineItems(id: string, data?: any, opts?: any): Promise<{ data: any[] }>;
      update(id: string, data: any, opts?: any): Promise<any>;
    };
    webhooks: {
      constructEvent(payload: string | Buffer, sig: string, secret: string): Stripe.Event;
    };
  }
  namespace Stripe {
    interface Event {
      type: string;
      data: { object: any };
    }
  }
  export = Stripe;
}
