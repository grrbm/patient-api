import axios, { AxiosResponse } from 'axios';
import { config, PharmacyApiConfig, PharmacyApiResponse } from './config';

interface PharmacyProduct {
  sku: number;
  quantity: number;
  refills: number;
  days_supply: number;
  sig: string;
  medical_necessity: string;
}

interface CreateOrderRequest {
  patient_id: number;
  physician_id: number;
  ship_to_clinic: 0 | 1; // 1 = Yes, 0 = No
  service_type: string;
  signature_required: number;
  memo: string;
  external_id?: string;
  test_order: 0 | 1; // 1 for testing
  products: PharmacyProduct[];
}



interface UpdatePatientAddressRequest {
  full: string;
  street: string;
  street_2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const demoOrder = {
  "patient_id": 1,
  "physician_id": 1,
  "ship_to_clinic": 0,
  "service_type": "two_day",
  "signature_required": 1,
  "memo": "Test memo",
  "external_id": "testing",
  "test_order": 1,
  number: 1,
  "status": "Pending",
  "stage": "Filling",
  "products": [
    {
      "sku": 1213,
      "quantity": 30,
      "refills": 2,
      "days_supply": 30,
      "sig": "Use as directed",
      "medical_necessity": "Patient has a history of diabetes and requires treatment to improve quality of life."
    }
  ]
}

class OrderService {
  private config: PharmacyApiConfig;

  constructor() {
    this.config = config
  }

  async createOrder(orderData: CreateOrderRequest): Promise<PharmacyApiResponse> {
    try {
      // const response: AxiosResponse = await axios.post(
      //   `${this.config.baseUrl}/api/clinics/orders`,
      //   {
      //     ...orderData,
      //     clinicId: this.config.clinicId
      //   },
      //   {
      //     params: {
      //       api_key: this.config.apiKey
      //     },
      //     headers: {
      //       'Content-Type': 'application/json',
      //     }
      //   }
      // );

      return {
        success: true,
        data: demoOrder
      };
    } catch (error) {
      console.error('Error creating pharmacy order:', error);

      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.message || error.message,
          message: `HTTP ${error.response?.status}: ${error.response?.statusText}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async getOrder(orderId: number): Promise<PharmacyApiResponse> {
    try {
      // const response: AxiosResponse = await axios.get(
      //   `${this.config.baseUrl}/api/clinics/orders/${orderId}`,
      //   {
      //     params: {
      //       api_key: this.config.apiKey
      //     },
      //     headers: {
      //       'Content-Type': 'application/json',
      //     }
      //   }
      // );

      return {
        success: true,
        data: {
          "number": 123456789,
          "external_id": "test",
          "status": "Pending",
          "stage": "Filling",
          "service_type": "two_day",
          "filled_at": null,
          "verified_at": null,
          "shipped_at": null,
          "created_at": "2022-01-21T13:25:09.000000Z",
          "updated_at": "2022-01-21T13:25:09.000000Z",
          "address": {
            "full": "101 Some Street, Burleson, TX 76028 USA",
            "street": "101 Some Street",
            "street_2": null,
            "city": "Burleson",
            "state": "TX",
            "zip": "76028",
            "country": "USA"
          },
          "patient": {
            "id": 1,
            "first_name": "John",
            "middle_name": "Michael",
            "last_name": "Doe",
            "formatted_name": "Doe, John Michael",
            "email": "john@doe.com",
            "dob": "1979-01-01",
            "gender": "Male",
            "phone_number": "7778889999",
            "drivers_license_number": null,
            "drivers_license_state": null,
            "created_at": "2022-01-14T17:49:38.000000Z",
            "updated_at": "2022-01-14T17:49:38.000000Z",
            "deleted_at": null,
            "allergies": [
              {
                "name": "Nuts"
              }
            ],
            "diseases": [
              {
                "name": "None"
              }
            ],
            "medications": [
              {
                "name": "Tylenol",
                "strength": "500mg"
              }
            ],
            "links": {
              "api": {
                "update": {
                  "url": "https://portal.absoluterx.com/api/clinics/patients/1?api_key=<api_key>",
                  "method": "PUT",
                  "axios_method": "put"
                }
              }
            }
          },
          "physician": {
            "id": 1,
            "email": null,
            "first_name": "JANE",
            "middle_name": null,
            "last_name": "DOE",
            "phone_number": "9998887777",
            "first_and_last_name": "JANE DOE",
            "first_letter_of_last_name": "D",
            "dea_number": null,
            "npi_number": "9876543211",
            "links": {
              "api": {
                "show": {
                  "url": "https://portal.absoluterx.com/api/clinics/physicians/1?api_key=<api_key>",
                  "method": "GET",
                  "axios_method": "get"
                },
                "update": {
                  "url": "https://portal.absoluterx.com/api/clinics/physicians/1?api_key=<api_key>",
                  "method": "PUT",
                  "axios_method": "put"
                }
              }
            }
          },
          "shipment": null,
          "links": {
            "api": {
              "show": {
                "url": "https://portal.absoluterx.com/api/clinics/orders/123456789?api_key=<api_key>",
                "method": "GET",
                "axios_method": "get"
              }
            }
          }
        }
      };
    } catch (error) {
      console.error('Error fetching pharmacy order:', error);

      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.message || error.message,
          message: `HTTP ${error.response?.status}: ${error.response?.statusText}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async updatePatientAddress(orderId: number, addressData: UpdatePatientAddressRequest): Promise<PharmacyApiResponse> {
    try {
      const requestData = {
        api_key: this.config.apiKey,
        ...addressData
      };

      // const response: AxiosResponse = await axios.put(
      //   `${this.config.baseUrl}/api/clinics/orders/${orderId}/patient-address`,
      //   requestData,
      //   {
      //     headers: {
      //       'Content-Type': 'application/json',
      //     }
      //   }
      // );

      return {
        success: true,
        data: {
          "message": "Shipping address updated successfully",
          "data": {
            "order_id": 185081,
            "full": "117 FOREST HILL DR, Richmond, KY, 40475",
            "street": "117 FOREST HILL DR",
            "street_2": null,
            "city": "Richmond",
            "state": "KY",
            "zip": "40475",
            "country": "US"
          }
        }
      };
    } catch (error) {
      console.error('Error updating patient address:', error);

      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.message || error.message,
          message: `HTTP ${error.response?.status}: ${error.response?.statusText}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async deleteOrder(orderId: number): Promise<PharmacyApiResponse> {
    try {
      // const response: AxiosResponse = await axios.delete(
      //   `${this.config.baseUrl}/api/clinics/orders/${orderId}`,
      //   {
      //     params: {
      //       api_key: this.config.apiKey
      //     },
      //     headers: {
      //       'Content-Type': 'application/json',
      //     }
      //   }
      // );

      // Orders can only be deleted (cancelled) as long as they have not been shipped.
      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting pharmacy order:', error);

      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.message || error.message,
          message: `HTTP ${error.response?.status}: ${error.response?.statusText}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

export default OrderService;
export { CreateOrderRequest, PharmacyProduct, UpdatePatientAddressRequest };