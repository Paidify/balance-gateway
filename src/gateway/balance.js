import { Router } from 'express';
import { readOne } from '../helpers/crud.js'
import poolP from '../services/dbPaidify.js';
import poolU from '../services/dbUniv.js';
import { WESTERN_BANK_API_URL, EAST_BANK_API_URL, JWT_SECRET } from '../config/index.config.js';
import { cardIsWestern, validateCardNumbers } from '../helpers/utils.js';
import fetch from '../helpers/fetch.js';
import { ROLE_DEFAULT } from '../config/constants.js';
import jwt from 'jsonwebtoken';

const router = new Router();

router.use('/', async function (req, res) {
    const { card_numbers } = req.body;
    if(!validateCardNumbers(card_numbers)) {
        return res.status(400).json({ message: 'Bad request' });
    }

    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).json({
        message: 'Access denied. Please provide your access token in the Authorizarion header with the Bearer schema.'
    });
    let token;
    try {
        token = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    } catch (err) {
        console.log(err);
        res.status(400).json({ message: 'Invalid token' });
    }
    if (token.role !== ROLE_DEFAULT) {
        return res.status(401).json({ message: 'You are not authorized to perform this action' });
    }

    const userId = token.id;
    let userCards;
    try {
        userCards = (await readMany(
            'payment_method',
            { 'payment_method': ['card_number'] },
            [],
            { 'user_id': userId },
            poolP
        )).map(({ card_number }) => card_number);
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
    if(!card_numbers.some(card => userCards.contains(card))) {
        return res.status(403).json({ message: 'Forbidden' })
    }
    
    let person;
    try {
        const personId = (await readOne(
            'user', { 'user': ['person_id'], }, [], { id: userId }, poolP
        )).person_id;
        person = await readOne(
            'person',
            { 'person': ['doc_number', 'first_name', 'last_name'] },
            null,
            { 'id': personId },
            poolU
        );
    } catch (err) {
        if(err.message === 'Not found') return res.status(404).json({ message: 'User or person not found' });
        return res.status(500).json({ message: 'Internal server error' });
    }
    // const person = { first_name: 'Gustavo', last_name: 'Marques', doc_number: 'ZTFL' };
    
    const cardsWestern = [], cardsEast = [];
    card_numbers.forEach(card => cardIsWestern(card) ? cardsWestern.push(card) : cardsEast.push(card));

    let balances = [];
    if(cardsWestern.length) {
        try {
            const { data: json } = await fetch(WESTERN_BANK_API_URL + '/checkbalance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    'id': person.doc_number,
                    'nombre': person.first_name + ' ' + person.last_name,
                    'nroTarjetas': cardsWestern
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
            const { data: json } = await fetch(EAST_BANK_API_URL + '/checkbalance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    'id': person.doc_number,
                    'nombre': person.first_name + ' ' + person.last_name,
                    'nroTarjetas': cardsEast
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
    // if(card_numbers.length !== balances.length) {
    //     return res.status(500).json({ message: 'Internal server error' });
    // }
    return res.status(200).json(balances);
});

export default router;
