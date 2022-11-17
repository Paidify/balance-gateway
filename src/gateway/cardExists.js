import { Router } from 'express';
import { readOne } from '../helpers/crud.js'
import poolP from '../services/dbPaidify.js';
import poolU from '../services/dbUniv.js';
import { WESTERN_BANK_API_URL, EAST_BANK_API_URL } from '../config/index.config.js';
import { cardIsWestern, validateCardNumber  } from '../helpers/utils.js';
import fetch from '../helpers/fetch.js';

const router = new Router();

router.use('/', async function (req, res) {
    const { card_number, user_id } = req.body;
    if (!user_id || !validateCardNumber(card_number)) return res.status(400).json({ message: 'Bad request' });

    let person;
    try {
        const personId = (
            await readOne('user', { 'user': ['person_id'] }, [], { id: user_id }, poolP)
        ).person_id;
        person = await readOne(
            'person',
            { 'person': ['doc_number', 'first_name', 'last_name'] },
            null,
            { 'id': personId },
            poolU
        );
    } catch (err) {
        if (err.message === 'Not found') return res.status(404).json({ message: 'User or person not found' });
        return res.status(500).json({ message: 'Internal server error' });
    }
    // const person = { first_name: 'Gustavo', last_name: 'Marques', doc_number: 'ZTFL' };

    try {
        const { data: json } = await fetch(
            cardIsWestern(card_number) ? WESTERN_BANK_API_URL : EAST_BANK_API_URL + '/checkbalance',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    'id': person.doc_number,
                    'nombre': person.first_name + ' ' + person.last_name,
                    'nroTarjetas': [card_number],
                }),
            }
        );
        console.log(json);
        if (json.message !== 'OK') throw new Error();
    } catch (err) {
        return res.status(500).json({
            message: `Internal server error when requesting ${cardIsWestern(card_number) ? 'Western' : 'East'} Bank`
        });
    }

    res.status(200).json({ exists: true });
});

export default router;
