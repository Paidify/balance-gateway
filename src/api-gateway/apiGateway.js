import fetch from '../helpers/fetch.js';
import { HOST, API_GATEWAY_URL } from '../config/index.config.js';

export default async function () {
    try {
        const { data } = await fetch(API_GATEWAY_URL + '/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
                service: 'balance',
                url: HOST,
            },
            timeout: 10000,
        });
        return { message: data.message };
    } catch(err) {
        return { message: 'API Gateway is not responding', error: err.message };
    }
}
