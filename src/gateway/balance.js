import { Router } from 'express';
import { readOne } from '../helpers/crud.js'
import poolP from '../services/dbPaidify.js';
import poolU from '../services/dbUniv.js';
import { WESTERN_BANK_API_ENDPOINT, EAST_BANK_API_ENDPOINT } from '../config/index.config.js';
import { cardIsWestern, validateCardNumbers } from '../helpers/utils.js';
import fetch from '../helpers/fetch.js';

const router = new Router();

router.post('/', async (req, res) => {
    const { user_id, card_numbers } = req.body;
    if(!user_id || !validateCardNumbers(card_numbers)) {
        return res.status(400).json({ message: 'Bad request' });
    }

    let user, person;
    try {
        user = await readOne('user', { 'user': ['person_id'], }, [], { id: user_id }, poolP);
    } catch (err) {
        if(err.message === 'Not found') return res.status(404).json({ message: 'User not found' });
        return res.status(500).json({ message: 'Internal server error' });
    }

    try {
        person = await readOne(
            'person',
            { 'person': ['doc_number', 'email', 'first_name', 'last_name'] },
            null,
            { 'id': user.person_id },
            poolU
        );
    } catch (err) {
        if(err.message === 'Not found') return res.status(404).json({ message: 'Person not found' });
        return res.status(500).json({ message: 'Internal server error' });
    }

    const { doc_number, email, first_name, last_name } = person;
    const cardsWestern = card_numbers.filter(cardIsWestern);
    const cardsEast = card_numbers.filter(card => !cardIsWestern(card));

    let balances = [];
    if(cardsWestern.length) {
        try {
            const { data: json } = await fetch(WESTERN_BANK_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'id': doc_number,
                    'nombre': first_name + ' ' + last_name,
                    'email': email,
                    'nroTarjetas': cardsWestern,
                }),
            });
            console.log(json);
            if(json.message === 'OK') {
                balances = balances.concat(json.data.balance);
            } else throw new Error();
        } catch (err) {
            return res.status(500).json({ message: 'Internal server error when requesting Western Bank' });
        }
    }

    if(cardsEast.length) {
        try {
            const { data: json } = await fetch(EAST_BANK_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'id': doc_number,
                    'name': first_name + ' ' + last_name,
                    'email': email,
                    'nroTarjetas': cardsEast,
                }),
            });
            if(json.message === 'OK') {
                balances = balances.concat(json.data.balance);
            } else throw new Error();
        } catch (err) {
            return res.status(500).json({ message: 'Internal server error when requesting East Bank' });
        }
    }
    return res.status(200).json(balances);
});

export default router;
