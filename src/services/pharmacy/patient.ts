import axios, { AxiosResponse } from 'axios';
import { config, PharmacyApiConfig, PharmacyApiResponse } from './config';

interface PatientAllergy {
  name: string;
}

interface PatientDisease {
  name: string;
}

interface PatientMedication {
  name: string;
  strength: string;
}

interface PatientAddress {
  street: string;
  street_2?: string;
  city: string;
  state: string;
  zip: string;
}

interface CreatePatientRequest {
  first_name: string;
  middle_name?: string;
  last_name: string;
  dob: string; // Format: YYYY-MM-DD
  gender: string;
  allergies: PatientAllergy[];
  diseases: PatientDisease[];
  medications: PatientMedication[];
  email: string;
  phone_number: string; // The phone number must be 10 characters
  address: PatientAddress;
}

const mockPatient = {
  "data": {
    "id": "123456789",
    "first_name": "John",
    "middle_name": null,
    "last_name": "Doe",
    "formatted_name": "Doe, John",
    "email": "john@doe.com",
    "dob": "1979-01-01",
    "gender": "Male",
    "phone_number": "888888888",
    "drivers_license_number": null,
    "drivers_license_state": null,
    "created_at": "2022-01-14T17:49:38.000000Z",
    "updated_at": "2022-01-14T17:49:38.000000Z",
    "deleted_at": null,
    "address": {
      "full": "101 Some Street, Some City, FL 33549 USA",
      "street": "101 Some Street",
      "street_2": null,
      "city": "Some City",
      "state": "FL",
      "zip": "33549",
      "country": "USA"
    },
    "allergies": [
      {
        "id": 1,
        "name": "nuts",
        "api": {
          "delete": {
            "url": "https://portal.absoluterx.com/api/clinics/allergies/1?api_key=<your_api_key>",
            "method": "DELETE",
            "axios_method": "delete"
          },
          "update": {
            "url": "https://portal.absoluterx.com/api/clinics/allergies/1?api_key=<your_api_key>",
            "method": "PUT",
            "axios_method": "put"
          }
        }
      }
    ],
    "diseases": [
      {
        "id": 1,
        "name": "Depression",
        "api": {
          "delete": {
            "url": "https://portal.absoluterx.com/api/clinics/diseases/1?api_key=<your_api_key>",
            "method": "DELETE",
            "axios_method": "delete"
          },
          "update": {
            "url": "https://portal.absoluterx.com/api/clinics/diseases/1?api_key=<your_api_key>",
            "method": "PUT",
            "axios_method": "put"
          }
        }
      }
    ],
    "medications": [
      {
        "id": 1,
        "name": "Tylenol",
        "strength": "500mg",
        "delete": {
          "url": "https://portal.absoluterx.com/api/clinics/medications/1?api_key=<your_api_key>",
          "method": "DELETE",
          "axios_method": "delete"
        },
        "update": {
          "url": "https://portal.absoluterx.com/api/clinics/medications/1?api_key=<your_api_key>",
          "method": "PUT",
          "axios_method": "put"
        }
      }
    ],
    "links": {
      "api": {
        "update": {
          "url": "https://portal.absoluterx.com/api/clinics/patients/1?api_key=<your_api_key>",
          "method": "PUT",
          "axios_method": "put"
        }
      }
    }
  }
}

class PatientService {
  private config: PharmacyApiConfig;

  constructor() {
    this.config = config
  }

  async createPatient(patientData: CreatePatientRequest): Promise<PharmacyApiResponse> {
    try {
      const response: AxiosResponse = await axios.post(
        `${this.config.baseUrl}/api/clinics/patients`,
        patientData,
        {
          params: {
            api_key: this.config.apiKey
          },
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error creating patient:', error);

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

  async updatePatient(patientId: number, patientData: CreatePatientRequest): Promise<PharmacyApiResponse> {
    try {
      const response: AxiosResponse = await axios.put(
        `${this.config.baseUrl}/api/clinics/patients/${patientId}`,
        patientData,
        {
          params: {
            api_key: this.config.apiKey
          },
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error updating patient:', error);

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

export default PatientService;
export {
  CreatePatientRequest,
  PatientAllergy,
  PatientDisease,
  PatientMedication,
  PatientAddress,
};