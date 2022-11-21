import { Router } from 'express';
import { readMany, readOne } from '../helpers/crud.js'
import poolP from '../services/dbPaidify.js';
import poolU from '../services/dbUniv.js';
import { WESTERN_BANK_API_ENDPOINT, EAST_BANK_API_ENDPOINT, JWT_SECRET } from '../config/index.config.js';
import { cardIsWestern, parseOwnerName, validateCardNumbers } from '../helpers/utils.js';
import fetch from '../helpers/fetch.js';
import { ROLE_DEFAULT } from '../config/constants.js';
import jwt from 'jsonwebtoken';

const router = new Router();

router.use('/', async function (req, res) {
    const { card_numbers } = req.body;
    if (!validateCardNumbers(card_numbers)) {
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
    
    let userCards; // userCards will be the cards that the user has from now on
    try {
        userCards = await readMany(
            'payment_method',
            { 'payment_method': ['card_number', 'owner', 'card_type_id'] },
            [],
            { 'user_id': userId, 'card_number': card_numbers },
            null, null, poolP
        );
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
    if (userCards.length !== card_numbers.length) {
        return res.status(403).json({ message: 'Forbidden' })
    }

    // before continuing, parse cards owner from upper case to "normal"
    userCards.forEach(card => card.owner = parseOwnerName(card.owner));
    
    const cardsWestern = [], cardsEast = [];
    userCards.forEach(card => cardIsWestern(card.card_number) ?
        cardsWestern.push(card)
        : cardsEast.push(card)
    );
    // 
    const promises = [];
    
    if (cardsWestern.length) {
        console.log({
            'tarjetas': cardsWestern.map(({ card_number, card_type_id, owner }) => ({
                'numero': card_number,
                'owner': owner,
                'tipo': card_type_id
            }))
        });
        promises.push(fetch(WESTERN_BANK_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
                'tarjetas': cardsWestern.map(({ card_number, card_type_id, owner }) => ({
                    'numero': card_number,
                    'owner': owner,
                    'tipo': card_type_id
                }))
            }
        }));
    }

    if (cardsEast.length) {
        console.log({
            'tarjetas': cardsEast.map(({ card_number, card_type_id, owner }) => ({
                'numero': card_number,
                'owner': owner,
                'tipo': card_type_id
            }))
        });
        promises.push(fetch(EAST_BANK_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
                'tarjetas': cardsEast.map(({ card_number, card_type_id, owner }) => ({
                    'numero': card_number,
                    'owner': owner,
                    'tipo': card_type_id
                }))
            }
        }));
    }

    let responses;
    try {
        responses = await Promise.all(promises);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
    
    let balances = [];
    for (let i = 0; i < responses.length; i++) {
        if (responses[i].status !== 200) {
            return res.status(responses[i].status).json({ message: responses[i].data.message });
        }
        const { saldos } = responses[i].data;
        balances = balances.concat(saldos);
    }
    
    res.status(200).json(balances);
});

export default router;
