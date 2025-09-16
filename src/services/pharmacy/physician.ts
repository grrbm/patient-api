import axios, { AxiosResponse } from 'axios';
import { config, PharmacyApiConfig, PharmacyApiResponse } from './config';

interface PhysicianLicense {
  state: string;
  number: string;
  type: string;
  expires_on: string;
}

interface CreatePhysicianRequest {
  first_name: string;
  middle_name?: string;
  last_name: string;
  phone_number: string;
  email: string;
  dea_number: string;
  npi_number: string;
  street: string;
  street_2?: string;
  city: string;
  state: string;
  zip: string;
  licenses: PhysicianLicense[];
}

const mockPhysician = {
  "data": {
    "id": 1,
    "email": "physician@someclinic.com",
    "first_name": "JOHN",
    "middle_name": null,
    "last_name": "DOE",
    "phone_number": "7778889999",
    "first_and_last_name": "JOHN DOE",
    "first_letter_of_last_name": "S",
    "dea_number": "BB1388568",
    "npi_number": "1234567891",
    "licenses": [
      {
        "state": "Montana",
        "number": "12345",
        "type": "MEDICAL",
        "expires_on": "2022-06-31",
        "approved": 1,
        "expired": false
      }
    ],
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
  }
}

class PhysicianService {
  private config: PharmacyApiConfig;

  constructor() {
    this.config = config
  }

  async createPhysician(physicianData: CreatePhysicianRequest): Promise<PharmacyApiResponse> {
    try {
      // const response: AxiosResponse = await axios.post(
      //   `${this.config.baseUrl}/api/clinics/physicians`,
      //   physicianData,
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
        data: mockPhysician
      };
    } catch (error) {
      console.error('Error creating physician:', error);

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

  async updatePhysician(physicianId: number, physicianData: CreatePhysicianRequest): Promise<PharmacyApiResponse> {
    try {
      // const response: AxiosResponse = await axios.put(
      //   `${this.config.baseUrl}/api/clinics/physicians/${physicianId}`,
      //   physicianData,
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
        data: mockPhysician
      };
    } catch (error) {
      console.error('Error updating physician:', error);

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

export default PhysicianService;
export {
  CreatePhysicianRequest,
  PhysicianLicense,
};