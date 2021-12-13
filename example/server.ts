import express from 'express';
import { OpenAPIV3 } from 'openapi-types';
import { serve, setup } from 'swagger-ui-express';

import {
    doc,
    Endpoint,
    queryParam,
    Router,
} from '../src/index';


@doc({
    summary: 'This endpoint will display Hello world.',
})
class HelloWorld extends Endpoint {
    @queryParam({
        description: 'name of the person to great.',
        example: 'Alex',
    })
    name?: string;

    handler() {
        this.res.send(`Hello ${this.name || 'world'}`);
    }
}

@doc({
    summary: 'This is a second endpoint.',
})
class Second extends Endpoint {
    handler() {
        this.res.send(`ok`);
    }
}

console.log(new HelloWorld().doc);
const router = Router();
router.get('/api/hello', new HelloWorld());
router.post('/api/second', new Second());

const apiDoc: OpenAPIV3.Document = {
    openapi: '3.0.1',
    info: {
        description: 'This API serve an example.',
        version: '1.0.0',
        title: 'Hello world',
    },
    paths: router.doc,
};

(async function createServer() {
    const port = 3000;
    const app = express();
    app.get('/api-docs', (_req, res) => res.json(apiDoc));
    app.use(router);
    app.use('/', serve, setup(apiDoc));
    app.listen(port, () => {
        console.info(`Ready to accept connections on port: ${port}`);
    });
})();
