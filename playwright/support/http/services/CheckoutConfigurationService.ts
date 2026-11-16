import { RegisterService } from '../decorators/ServiceDecorator';
import { SERVICE_KEYS } from '../types/ServiceTypes';
import { BaseService } from './BaseService';
import {
  ConfigVault,
  CreateConfigCheckoutV2Request,
  CreateConfigCheckoutV2Response,
  CreateWebhookResponse,
  CreateCustomFieldData,
  CreateCustomFieldResponse,
} from '../models/checkoutConfiguration';
import {
  vaultWoWCheckoutConfigData,
  vaultWoWCheckoutConfigV2Data,
} from '../testData/checkout_configuration/VaultWoWConfig';
import { clickToPayCheckoutConfigData } from '../testData/checkout_configuration/ClickToPayConfig';
import { ThemeConfig, WidgetsGeneralConfig } from '@support/interfaces/CheckoutConfigurationV2';
import { EndpointConfig } from '../config/EndpointConfig';
import { CreateWebhookData } from '../models/checkoutConfiguration';
import { ApiError, ApiResponse } from '../BaseHttpClient';
import { CreateCheckoutRequest, CreateCheckoutResponse } from '../models/checkoutConfiguration';
import { describeApiError } from '../utils/describeApiError';
import { assertHttpResponse } from 'playwright/framework/httpContract';
import { redact } from 'playwright/framework/redact';

@RegisterService(SERVICE_KEYS.CHECKOUT_CONFIGURATION)
export class CheckoutConfigurationService extends BaseService {
  async createCheckout(checkoutRequest: CreateCheckoutRequest): Promise<CreateCheckoutResponse> {
    try {
      const response = await this.httpClient.request<CreateCheckoutResponse>({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'createCheckout'),
        data: checkoutRequest.createCheckoutData,
        method: 'POST',
        // apigw #1320 and merchant-auth #1348 authorize it by the Bearer alone; neither has ever
        // validated an X-Api-Key on this route.
        auth: {
          type: 'bearer',
          token: checkoutRequest.merchantToken,
        },
        pathParams: {
          merchantId: checkoutRequest.merchantId,
        },
        logging: {
          logRequest: false,
          logResponse: false,
          logHeaders: false,
          logData: false,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Checkout creation failed: ${describeApiError(error)}`);
    }
  }

  async createConfigCheckoutV2(
    configCheckoutV2Request: CreateConfigCheckoutV2Request
  ): Promise<CreateConfigCheckoutV2Response> {
    try {
      const response = await this.httpClient.request<CreateConfigCheckoutV2Response>({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'createConfigCheckoutV2'),
        data: configCheckoutV2Request.config_checkout_v2_data,
        method: 'POST',
        auth: {
          type: 'bearer',
          token: configCheckoutV2Request.merchant_token,
        },
        pathParams: {
          merchantId: configCheckoutV2Request.merchant_id,
        },
        logging: {
          logRequest: false,
          logResponse: false,
          logHeaders: false,
          logData: false,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Config checkout v2 creation failed: ${describeApiError(error)}`, {
        cause: redact(error),
      });
    }
  }

  async configVaultWow(merchantId: string, merchantToken: string) {
    await this.configVault({
      merchant_token: merchantToken,
      merchant_id: merchantId,
      config_vault_data: {
        config_checkout_data: vaultWoWCheckoutConfigData,
        config_checkout_v2_data: vaultWoWCheckoutConfigV2Data,
      },
    });
  }

  async configVault(configVaultRequest: ConfigVault) {
    const merchantToken = configVaultRequest.merchant_token;
    const merchantId = configVaultRequest.merchant_id;

    const configCheckoutV2Request: CreateConfigCheckoutV2Request = {
      merchant_token: merchantToken,
      merchant_id: merchantId,
      config_checkout_v2_data: configVaultRequest.config_vault_data.config_checkout_v2_data,
    };

    try {
      await this.createConfigCheckoutV2(configCheckoutV2Request);
    } catch (error) {
      const cause = error instanceof Error ? (error.cause as Partial<ApiError>) : undefined;
      if (
        cause?.status !== 500 ||
        cause.code !== 'CHKCONFIG-4106' ||
        cause.description !== 'configuration already exists'
      ) {
        throw error;
      }

      // Memoized merchants can reach this setup again in another spec on the same worker.
      let existing: ApiResponse;
      try {
        existing = await this.httpClient.request({
          url: EndpointConfig.getEndpoint('checkoutConfiguration', 'createConfigCheckoutV2'),
          method: 'GET',
          auth: { type: 'bearer', token: merchantToken },
          pathParams: { merchantId },
          logging: {
            logRequest: false,
            logResponse: false,
            logHeaders: false,
            logData: false,
          },
        });
      } catch (readError) {
        throw new Error(`Existing checkout v2 read failed: ${describeApiError(readError)}`, {
          cause: redact(readError),
        });
      }
      assertHttpResponse(
        { method: 'GET', operation: 'reuseExistingVaultConfiguration' },
        { status: existing.status, body: existing.data },
        {
          status: 200,
          body: { ...configCheckoutV2Request.config_checkout_v2_data, merchant_id: merchantId },
        }
      );
    }
  }

  async configClickToPay(
    merchantId: string,
    merchantToken: string,
    themeConfig: ThemeConfig
  ): Promise<void> {
    await this.createConfigCheckoutV2({
      merchant_token: merchantToken,
      merchant_id: merchantId,
      config_checkout_v2_data: {
        order_config: {
          notify_type: 'async',
          payment_link: {
            generate_user_auth_token: true,
          },
        },
        // @ts-ignore
        payment_credential_sources:
          clickToPayCheckoutConfigData.configuration.payment_credential_sources,
        elements_config: {
          init_with_guest_user: true,
          user_authentication_flow: false,
          theme_config: themeConfig,
          show_saved_cards_flow: false,
        },
      },
    });
  }

  async configSplitPaymentWithClickToPay(
    merchantId: string,
    merchantToken: string,
    config: { widgetGeneralConfig?: Partial<WidgetsGeneralConfig> } = {}
  ) {
    await this.createConfigCheckoutV2({
      merchant_token: merchantToken,
      merchant_id: merchantId,
      config_checkout_v2_data: {
        order_config: {
          notify_type: 'async',
          payment_link: {
            generate_user_auth_token: true,
          },
        },
        elements_config: {
          init_with_guest_user: true,
          user_authentication_flow: false,
          show_saved_cards_flow: false,
        },
        widgets_general_config: config.widgetGeneralConfig,
      },
    });
  }

  async createWebhook(
    merchantId: string,
    merchantToken: string,
    webhookData: CreateWebhookData,
    expectError: boolean = false
  ): Promise<ApiResponse<CreateWebhookResponse>> {
    try {
      const response = await this.httpClient.request<CreateWebhookResponse>({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'createWebhook'),
        data: webhookData,
        method: 'POST',
        auth: {
          type: 'bearer',
          token: merchantToken,
        },
        pathParams: {
          merchantId: merchantId,
        },
        expectError: expectError,
        logging: {
          logRequest: false,
          logResponse: false,
          logHeaders: false,
          logData: false,
        },
      });

      return response;
    } catch (error) {
      throw new Error(`Webhook creation failed: ${JSON.stringify(error)}`);
    }
  }

  async updateWebhook(
    merchantId: string,
    merchantToken: string,
    eventName: string,
    webhookData: CreateWebhookData,
    expectError: boolean = false
  ): Promise<ApiResponse<CreateWebhookResponse>> {
    try {
      const response = await this.httpClient.request<CreateWebhookResponse>({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'updateWebhook'),
        data: webhookData,
        method: 'PATCH',
        auth: {
          type: 'bearer',
          token: merchantToken,
        },
        pathParams: {
          merchantId: merchantId,
          eventName: eventName,
        },
        expectError: expectError,
        logging: {
          logRequest: false,
          logResponse: false,
          logHeaders: false,
          logData: false,
        },
      });

      return response;
    } catch (error) {
      throw new Error(`Webhook update failed: ${JSON.stringify(error)}`);
    }
  }

  async createCustomField(
    customFieldData: CreateCustomFieldData,
    merchantId: string,
    merchantToken: string,
    expectError: boolean = false
  ): Promise<ApiResponse<CreateCustomFieldResponse>> {
    try {
      const response = await this.httpClient.request<CreateCustomFieldResponse>({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'createCustomField'),
        data: customFieldData,
        method: 'POST',
        auth: {
          type: 'bearer',
          token: merchantToken,
        },
        pathParams: {
          merchantId: merchantId,
        },
        expectError: expectError,
      });

      return response;
    } catch (error) {
      throw new Error(`Custom field creation failed: ${JSON.stringify(error)}`);
    }
  }

  async getAllThemes(privateKey: string): Promise<ApiResponse<unknown>> {
    try {
      return await this.httpClient.request({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'getAllThemes'),
        method: 'GET',
        auth: { type: 'api-key', apiKey: privateKey },
        logging: {
          logRequest: false,
          logResponse: false,
          logHeaders: false,
          logData: false,
        },
      });
    } catch (error) {
      throw new Error(`getAllThemes failed: ${JSON.stringify(error)}`);
    }
  }

  async createTheme(
    privateKey: string,
    name: string,
    config?: Record<string, unknown>,
    expectError: boolean = false
  ): Promise<ApiResponse<unknown>> {
    try {
      return await this.httpClient.request({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'getAllThemes'),
        method: 'POST',
        data: { name, config },
        auth: { type: 'api-key', apiKey: privateKey },
        expectError,
      });
    } catch (error) {
      throw new Error(`createTheme failed: ${JSON.stringify(error)}`);
    }
  }

  async updateTheme(
    privateKey: string,
    themeId: string,
    name: string,
    config?: Record<string, unknown>,
    expectError: boolean = false
  ): Promise<ApiResponse<unknown>> {
    try {
      return await this.httpClient.request({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'manageTheme'),
        method: 'PATCH',
        data: { name, config },
        pathParams: { themeId },
        auth: { type: 'api-key', apiKey: privateKey },
        expectError,
      });
    } catch (error) {
      throw new Error(`updateTheme failed: ${JSON.stringify(error)}`);
    }
  }

  async getCustomFields(merchantId: string, merchantToken: string): Promise<ApiResponse<unknown>> {
    try {
      return await this.httpClient.request({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'createCustomField'),
        method: 'GET',
        auth: { type: 'bearer', token: merchantToken },
        pathParams: { merchantId },
      });
    } catch (error) {
      throw new Error(`getCustomFields failed: ${JSON.stringify(error)}`);
    }
  }

  async getWebhooks(merchantId: string, merchantToken: string): Promise<ApiResponse<unknown>> {
    try {
      return await this.httpClient.request({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'createWebhook'),
        method: 'GET',
        auth: { type: 'bearer', token: merchantToken },
        pathParams: { merchantId },
      });
    } catch (error) {
      throw new Error(`getWebhooks failed: ${JSON.stringify(error)}`);
    }
  }

  async deleteTheme(
    privateKey: string,
    themeId: string,
    expectError: boolean = false
  ): Promise<ApiResponse<unknown>> {
    try {
      return await this.httpClient.request({
        url: EndpointConfig.getEndpoint('checkoutConfiguration', 'manageTheme'),
        method: 'DELETE',
        pathParams: { themeId },
        auth: { type: 'api-key', apiKey: privateKey },
        expectError,
      });
    } catch (error) {
      throw new Error(`deleteTheme failed: ${JSON.stringify(error)}`);
    }
  }
}
