import { Request, Response } from 'express';
import axios from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';

export const testChannexAPI = async (req: Request, res: Response) => {
  const { endpoint } = req.params;
  const { propertyId } = req.query;
  
  try {
    const client = axios.create({
      baseURL: env.OPENSHOPPING_BASE_URL,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${env.OPENSHOPPING_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let url = '';
    switch (endpoint) {
      case 'property_list':
        url = '/property_list';
        break;
      case 'property_info':
        url = `/${propertyId}/property_info`;
        break;
      case 'rooms':
        url = `/${propertyId}/rooms`;
        break;
      case 'closed_dates':
        url = `/${propertyId}/closed_dates`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid endpoint' });
    }

    logger.info('Making direct Channex API call', { url, propertyId });
    
    const response = await client.get(url);
    
    logger.info('Channex API Response', {
      url,
      status: response.status,
      headers: response.headers,
      data: JSON.stringify(response.data, null, 2)
    });

    res.json({
      success: true,
      url: `${env.OPENSHOPPING_BASE_URL}${url}`,
      status: response.status,
      data: response.data
    });

  } catch (error: any) {
    logger.error('Channex API Error', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    res.status(500).json({
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
};