
export interface PharmacyApiConfig {
    baseUrl: string;
    apiKey: string;
}

export interface PharmacyApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}


export const config: PharmacyApiConfig = {
      baseUrl: 'https://portal.absoluterx.com',
      apiKey: process.env.PHARMACY_API_KEY || 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE'
}