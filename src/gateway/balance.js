import { Router } from 'express';
import { readOne } from '../helpers/crud.js'
import poolP from '../services/dbPaidify.js';
import poolU from '../services/dbUniv.js';
import { WESTERN_BANK_API_ENDPOINT, EAST_BANK_API_ENDPOINT, JWT_SECRET } from '../config/index.config.js';
import { cardIsWestern, validateCardNumbers } from '../helpers/utils.js';
import fetch from '../helpers/fetch.js';
import { ROLE_DEFAULT } from '../config/constants.js';
import jwt from 'jsonwebtoken';

const router = new Router();

router.post('/', async (req, res) => {
    const { user_id } = req.body;
    if(!user_id) return res.status(400).json({ message: 'Missing user_id' });

    const { card_numbers } = req.body;
    if(!validateCardNumbers(card_numbers)) {
        return res.status(400).json({ message: 'Bad request' });
    }

    console.log(user_id, card_numbers);

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
            { 'person': ['doc_number', 'first_name', 'last_name'] },
            null,
            { 'id': user.person_id },
            poolU
        );
    } catch (err) {
        if(err.message === 'Not found') return res.status(404).json({ message: 'Person not found' });
        return res.status(500).json({ message: 'Internal server error' });
    }

    const { doc_number, first_name, last_name } = person;
    const cardsWestern = card_numbers.filter(cardIsWestern);
    const cardsEast = card_numbers.filter(card => !cardIsWestern(card));

    let balances = [];
    if(cardsWestern.length) {
        try {
            const { data: json } = await fetch(WESTERN_BANK_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    'id': doc_number,
                    'nombre': first_name + ' ' + last_name,
                    'nroTarjetas': cardsWestern,
                }),
            });
            console.log(json);
            if(json.message === 'OK') {
                balances = balances.concat(json.saldos);
            } else throw new Error();
        } catch (err) {
            return res.status(500).json({ message: 'Internal server error when requesting Western Bank' });
        }
    }
    if(cardsEast.length) {
        try {
            const { data: json } = await fetch(EAST_BANK_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    'id': doc_number,
                    'name': first_name + ' ' + last_name,
                    'nroTarjetas': cardsEast,
                }),
            });
            console.log(json);
            if(json.message === 'OK') {
                balances = balances.concat(json.saldos);
            } else throw new Error();
        } catch (err) {
            return res.status(500).json({ message: 'Internal server error when requesting East Bank' });
        }
    }
    if(card_numbers.length !== balances.length) {
        return res.status(500).json({ message: 'Internal server error' });
    }

    try {
        const token = jwt.verify(req.headers['authorization'].split(' ')[1], JWT_SECRET);
        if(token.role !== ROLE_DEFAULT || token.id !== user_id) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
    } catch (err) {
        return res.status(401).json({ cards: true }); // if this service is invoked by the Queries Service
    }

    let payMeths;
    try {
        payMeths = await readMany(
            'payment_method',
            { 'payment_method': ['card_number'] },
            [],
            { 'user_id': user_id },
            poolP
        );
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(balances.map(({ card_number, amount }) => ({
        card_number,
        balance: payMeths.some(payMeth => payMeth.card_number === card_number) ? amount : true,
    })));
});

export default router;
