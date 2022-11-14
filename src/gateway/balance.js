import { Router } from 'express';
import axios from 'axios';
import { createOne, deleteOne, readMany, readOne, updateOne } from '../helpers/crud.js'
import poolP from '../services/dbPaidify.js';
import poolU from '../services/dbUniv.js';
import { WESTERN_BANK_API_URL, EAST_BANK_API_URL } from '../config/index.config.js';

const router = new Router();

router.post('/', async (req, res) => {
    const { user_id, card_numbers } = req.body;
    if(!card_numbers || !Array.isArray(card_numbers) || !cards.length) {
        return res.status(400).json({ message: 'Missing parameters' });
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
            { 'person': ['doc_number'], 'doc_type': ['doc_type'], 'address': ['zip_code'] },
            [
                'JOIN address ON person.address_id = address.id',
                'JOIN doc_type ON person.doc_type_id = doc_type.id',
            ],
            { 'id': user.person_id },
            poolU
        );
    } catch (err) {
        if(err.message === 'Not found') return res.status(404).json({ message: 'Person not found' });
        return res.status(500).json({ message: 'Internal server error' });
    }

    const { doc_number, doc_type, zip_code } = person;

    // TODO: Call banks apis
});

export default router;
