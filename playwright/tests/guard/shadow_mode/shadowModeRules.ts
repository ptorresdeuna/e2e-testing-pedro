/**
 * Default merchant rules of the Clearsale shadow-mode scenarios, verbatim from the former specs.
 * PF-T177 runs the pre-auth ones (PF-T177, PF-T178) and PF-T180 the post-auth ones (PF-T179 to
 * PF-T182).
 */

export const PF_T177_RULE: Record<string, unknown> = {
  label: 'Default',
  priority: 1,
  status: 'enabled',
  is_default: true,
  trigger: 'merchant_rule',
  conditions: [],
  members: [
    {
      fraud_processor_id: '3',
      fraud_processor: 'CYBERSOURCE',
      sort: 1,
      capabilities: null,
      enabled: true,
      strategy: 'cascade',
      shadow_mode: false,
    },
    {
      fraud_processor: 'CLEARSALE',
      sort: 2,
      enabled: true,
      strategy: 'cascade',
      shadow_mode: true,
    },
  ],
  children: [
    {
      conditions: [
        {
          id: 5061,
          rule_option: {
            id: 15,
            label: 'fraud_risk',
          },
          operator: 'eq',
          operand_config: null,
          operand: 'high',
          operand_type: 'values',
          metadata_field_name: null,
          metadata_field_type: null,
          error_code: '',
          error_message: '',
        },
      ],
      members: [
        {
          payment_processor_id: 50,
          payment_processor_name: 'stripe',
          merchant_payment_processor_name: 'STRIPE_DIRECT',
          sort: 1,
          capabilities: ['cvv'],
          enabled: true,
          strategy: 'cascade',
        },
      ],
    },
    {
      conditions: [
        {
          id: 5062,
          rule_option: {
            id: 15,
            label: 'fraud_risk',
          },
          operator: 'eq',
          operand_config: null,
          operand: 'medium',
          operand_type: 'values',
          metadata_field_name: null,
          metadata_field_type: null,
          error_code: '',
          error_message: '',
        },
      ],
      members: [
        {
          payment_processor_id: 50,
          payment_processor_name: 'stripe',
          merchant_payment_processor_name: 'STRIPE_DIRECT',
          sort: 1,
          capabilities: ['cvv'],
          enabled: true,
          strategy: 'cascade',
          post_authorization: false,
          shadow_mode: false,
        },
      ],
    },
    {
      conditions: [
        {
          id: 5063,
          rule_option: {
            id: 15,
            label: 'fraud_risk',
          },
          operator: 'eq',
          operand_config: null,
          operand: 'low',
          operand_type: 'values',
          metadata_field_name: null,
          metadata_field_type: null,
          error_code: '',
          error_message: '',
        },
      ],
      members: [
        {
          payment_processor_id: 50,
          payment_processor_name: 'stripe',
          merchant_payment_processor_name: 'STRIPE_DIRECT',
          sort: 1,
          capabilities: ['cvv'],
          enabled: true,
          strategy: 'cascade',
        },
      ],
    },
  ],
};

export const PF_T178_RULE: Record<string, unknown> = {
  label: 'Default',
  priority: 1,
  status: 'enabled',
  is_default: true,
  trigger: 'payment',
  conditions: [],
  members: [
    {
      payment_processor_id: 50,
      payment_processor_name: 'stripe',
      merchant_payment_processor_name: 'STRIPE_DIRECT',
      sort: 1,
      capabilities: [],
      enabled: true,
      strategy: 'cascade',
    },

    {
      fraud_processor: 'CLEARSALE',
      sort: 2,
      strategy: 'cascade',
      shadow_mode: true,
    },
  ],
};

export const PF_T179_RULE: Record<string, unknown> = {
  label: 'Default',
  priority: 1,
  status: 'enabled',
  is_default: true,
  trigger: 'merchant_rule',
  conditions: [],
  members: [
    {
      fraud_processor_id: '3',
      fraud_processor: 'CYBERSOURCE',
      sort: 1,
      capabilities: null,
      enabled: true,
      strategy: 'cascade',
    },
    {
      fraud_processor: 'SIFT',
      sort: 2,
      enabled: true,
      strategy: 'cascade',
      shadow_mode: true,
    },
    {
      fraud_processor: 'CLEARSALE',
      sort: 3,
      enabled: true,
      strategy: 'cascade',
      shadow_mode: true,
      post_authorization: true,
    },
  ],
  children: [
    {
      conditions: [
        {
          id: 5061,
          rule_option: {
            id: 15,
            label: 'fraud_risk',
          },
          operator: 'eq',
          operand_config: null,
          operand: 'high',
          operand_type: 'values',
          metadata_field_name: null,
          metadata_field_type: null,
          error_code: '',
          error_message: '',
        },
      ],
      members: [
        {
          payment_processor_id: 50,
          payment_processor_name: 'stripe',
          merchant_payment_processor_name: 'STRIPE_DIRECT',
          sort: 1,
          capabilities: ['cvv'],
          enabled: true,
          strategy: 'cascade',
        },
      ],
    },
    {
      conditions: [
        {
          id: 5062,
          rule_option: {
            id: 15,
            label: 'fraud_risk',
          },
          operator: 'eq',
          operand_config: null,
          operand: 'medium',
          operand_type: 'values',
          metadata_field_name: null,
          metadata_field_type: null,
          error_code: '',
          error_message: '',
        },
      ],
      members: [
        {
          payment_processor_id: 50,
          payment_processor_name: 'stripe',
          merchant_payment_processor_name: 'STRIPE_DIRECT',
          sort: 1,
          capabilities: ['cvv'],
          enabled: true,
          strategy: 'cascade',
        },
      ],
    },
    {
      conditions: [
        {
          id: 5063,
          rule_option: {
            id: 15,
            label: 'fraud_risk',
          },
          operator: 'eq',
          operand_config: null,
          operand: 'low',
          operand_type: 'values',
          metadata_field_name: null,
          metadata_field_type: null,
          error_code: '',
          error_message: '',
        },
      ],
      members: [
        {
          payment_processor_id: 50,
          payment_processor_name: 'stripe',
          merchant_payment_processor_name: 'STRIPE_DIRECT',
          sort: 1,
          capabilities: ['cvv'],
          enabled: true,
          strategy: 'cascade',
        },
      ],
    },
  ],
};

export const PF_T180_RULE: Record<string, unknown> = {
  label: 'Default',
  priority: 1,
  status: 'enabled',
  is_default: true,
  trigger: 'payment',
  conditions: [],
  members: [
    {
      payment_processor_id: 50,
      payment_processor_name: 'stripe',
      merchant_payment_processor_name: 'STRIPE_DIRECT',
      sort: 1,
      capabilities: [],
      enabled: true,
      strategy: 'cascade',
    },
    {
      fraud_processor_id: '3',
      fraud_processor: 'CYBERSOURCE',
      sort: 2,
      capabilities: null,
      enabled: true,
      strategy: 'cascade',
      post_authorization: true,
    },
    {
      fraud_processor: 'CLEARSALE',
      sort: 3,
      strategy: 'cascade',
      shadow_mode: true,
      post_authorization: true,
    },
  ],
};

export const PF_T181_RULE: Record<string, unknown> = {
  label: 'Default',
  priority: 1,
  status: 'enabled',
  is_default: true,
  trigger: 'payment',
  conditions: [],
  members: [
    {
      payment_processor_id: 50,
      payment_processor_name: 'stripe',
      merchant_payment_processor_name: 'STRIPE_DIRECT',
      sort: 1,
      capabilities: [],
      enabled: true,
      strategy: 'cascade',
      post_authorization: false,
      shadow_mode: false,
    },
    {
      fraud_processor: 'CLEARSALE',
      sort: 2,
      strategy: 'cascade',
      shadow_mode: true,
      post_authorization: true,
    },
  ],
};

export const PF_T182_RULE: Record<string, unknown> = {
  label: 'Default',
  priority: 1,
  status: 'enabled',
  is_default: true,
  trigger: 'payment',
  conditions: [],
  members: [
    {
      payment_processor_id: 50,
      payment_processor_name: 'stripe',
      merchant_payment_processor_name: 'STRIPE_DIRECT',
      sort: 1,
      capabilities: [],
      enabled: true,
      strategy: 'cascade',
    },
    {
      fraud_processor_id: '3',
      fraud_processor: 'CYBERSOURCE',
      sort: 2,
      capabilities: null,
      enabled: true,
      strategy: 'cascade',
      post_authorization: true,
    },
    {
      fraud_processor: 'CLEARSALE',
      sort: 3,
      strategy: 'cascade',
      shadow_mode: true,
      post_authorization: true,
    },
    {
      fraud_processor: 'SIFT',
      sort: 4,
      strategy: 'cascade',
      shadow_mode: true,
    },
  ],
};
