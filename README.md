# express-openapi-decorator

An opiniated library using decorators in order to define openAPI documentation for an expressJs endpoint.

> This library is not a validator. To validate incoming request use [express-openapi-validator](https://www.npmjs.com/package/express-openapi-validator)

## How to use

Install peer dependency:

```sh
npm install express
```

Create a class, extending the abstract class Endpoint, for each endpoints.

```ts
@doc({
    summary: 'This endpoint will display Hello world.',
})
class HelloWorld extends Endpoint {
    handler() {
        this.res.send('Hello world');
    }
}
```

The OpenApi documentation is part of the endpoint instance:

```ts
console.log(new HelloWorld().doc);
```

Add the endpoint to the `Router`:

```ts
import { router } from 'express-openapi-decorator';

const router = Router();
router.get('/api/hello', new HelloWorld());
```

Create api doc:

```ts
const doc: OpenAPIV3.Document = {
    openapi: '3.0.1',
    info: {
        description: 'This API serve an example.',
        version: '1.0.0',
        title: 'Hello world',
    },
    paths: router.doc,
};
```

Expose router and doc with express:

```ts
const port = 3000;
const app = express();
app.get('/api-docs', (_req, res) => res.json(doc));
app.use(router);
app.listen(port, () => {
    logger.info(`Ready to accept connections on port: ${port}`);
});
```

To visualize the OpenApi documentation use [swagger-ui-express](https://www.npmjs.com/package/swagger-ui-express): `app.use('/ui', swaggerUi.serve, swaggerUi.setup(apiDoc));`

## Router

`const router = Router();` is an extension of express Router, working the same way, but instead to pass request handler to the route, endpoints should be passed.

`router.get(path: string, ...endpoints: Endpoint[])` will add the endpoint instances to the given path for the `get` method (this work for any method). It allow to merge multiple endpoints definition to one, this can be useful for example to create a security middleware:

```ts
@doc({
    security: [{ basicAuth: [] }],
})
class SecureEndpoint extends Endpoint {
    handler() {
        if (this.req.headers['authorization'] !== `Basic ${btoa('user:password')}`) {
            throw new Error('Invalid credential');
        }
        next();
    }
}

@doc({
    summary: 'This endpoint will display Hello world.',
})
class HelloWorld extends Endpoint {
    handler() {
        this.res.send('Hello world');
    }
}

router.get('/api/hello', new SecureEndpoint(), new HelloWorld());
```

`router` can then be used like a normal express router:

```ts
app.use(router);
```

It is possible to access the endpoints instances with `router.endpointInstances`.

`router.doc` return the OpenApi doc for each endpoints added to the router according there path and method.

```ts
const app = express();
const doc: OpenAPIV3.Document = {
    openapi: '3.0.1',
    info: {
        description: 'This API serve an example.',
        version: '1.0.0',
        title: 'Hello world',
    },
    paths: router.doc,
};
app.get('/api-docs', (_req, res) => res.json(doc));
```

## Decorators

To define the characteristic of the endpoint, we use decorators.

### @doc

The `@doc` decorator get an `OpenAPIV3.OperationObject` as first parameter, meaning that it is possible to define the whole endpoint documentation here. However, this definition might get partly overwritten by the following decorators.

```ts
@doc({
    summary: 'This endpoint will display Hello world.',
})
class HelloWorld extends Endpoint {}
```

### @pathParam

The `@pathParam` decorator get an `OpenAPIV3.ParameterBaseObject` as first parameter, to define the documentation of path parameter. When express will call the handler, the value of the parameter will be automatcally be populated to the endpoint object.

```ts
class HelloWorld extends Endpoint {
    @pathParam({ description: 'id of the device.', required: true, example: 123 })
    deviceId!: number;

    async handler() {
        const device = await getDevice(this.deviceId);
        // ...
    }
}
```

### @queryParam

The `@queryParam` decorator get an `OpenAPIV3.ParameterBaseObject` as first parameter, to define the documentation of a query parameter. When express will call the handler, the value of the parameter will be automatcally be populated to the endpoint object.

```ts
class HelloWorld extends Endpoint {
    @queryParam({ description: 'id of the device.', required: true, example: 123 })
    deviceId!: number;

    async handler() {
        const device = await getDevice(this.deviceId);
        // ...
    }
}
```

### @bodyProp

The `@bodyProp` decorator get an `OpenAPIV3.BodySchema` as first parameter, to define the documentation of a property from the body sent in the request. When express will call the handler, the value of the property will be automatcally be populated to the endpoint object.

```ts
class HelloWorld extends Endpoint {
    @bodyProp({ description: 'id of the device.', required: true, example: 123 })
    deviceId!: number;

    async handler() {
        const device = await getDevice(this.deviceId);
        // ...
    }
}
```

### @errorResponse

The `@errorResponse` decorator get an optional `OpenAPIV3.ResponsesObject` as first parameter. The value of error property must be of type Error, where the message will be automatically used as description in the OpenApi documentation.

```ts
class HelloWorld extends Endpoint {
    @errorResponse()
    errorConflict = new Error(`Device is already linked to another user`);

    async handler() {
        throw this.errorConflict;
    }
}
```

Or with status code

```ts
import { Conflict } from 'http-errors';

class Conflict extends Error {
    statusCode = 409;
}

class HelloWorld extends Endpoint {
    @errorResponse()
    errorConflict = new Conflict(`Device is already linked to another user`);

    async handler() {
        throw this.errorConflict;
    }
}
```

or using [http-errors](https://www.npmjs.com/package/http-error) library

```ts
import { Conflict } from 'http-errors';

class HelloWorld extends Endpoint {
    @errorResponse()
    errorConflict = new Conflict(`Device is already linked to another user`);

    async handler() {
        throw this.errorConflict;
    }
}
```
