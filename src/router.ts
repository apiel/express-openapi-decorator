import {
    Request,
    RequestHandler,
    NextFunction,
    Response,
    Router as ExpressRouter,
} from 'express';
import { OpenAPIV3 } from 'openapi-types';

import { Endpoint } from './Endpoint.class';

// should response really be omited?
export interface Doc extends Omit<OpenAPIV3.OperationObject, 'responses'> {
    responses?: OpenAPIV3.ResponsesObject;
}

export interface DocResponse
    extends Omit<OpenAPIV3.ResponsesObject, 'description'> {}

export interface Route {
    path: string;
    method: OpenAPIV3.HttpMethods;
}
export interface EndpointInstance {
    route: Route;
    doc: OpenAPIV3.OperationObject;
    endpoints: Endpoint[];
    handlers: ((
        req: Request,
        res: Response,
        next: NextFunction,
    ) => Promise<void>)[];
}

// fix async call error catching in express v4
const asyncHandler =
    (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);

// hacky way to convert express path to openAPI path
// should find a better solution
function convertPath(path: string) {
    return path
        .split('/')
        .map((part) => (part.startsWith(':') ? `{${part.substring(1)}}` : part))
        .join('/');
}

type Router = Omit<ExpressRouter, OpenAPIV3.HttpMethods> &
    RequestHandler &
    {
        [method in OpenAPIV3.HttpMethods]: (
            path: string,
            ...endpoints: Endpoint[]
        ) => Router;
    } & {
        endpointInstances: EndpointInstance[];
        doc: OpenAPIV3.PathsObject<{}, {}>;
    };

export function Router() {
    const router = ExpressRouter() as any as Router;
    router.endpointInstances = [];
    router.doc = {};

    function addEndpoint(
        method: OpenAPIV3.HttpMethods,
        path: string,
        ...endpoints: Endpoint[]
    ) {
        const doc = endpoints.reduce(
            (acc, { doc }) => ({ ...acc, ...doc }),
            {},
        ) as OpenAPIV3.OperationObject;
        const route = { path, method };
        const handlers = endpoints.map((endpoint) =>
            asyncHandler(endpoint.handle.bind(endpoint)),
        );
        const instance = { route, doc, endpoints, handlers };
        router.endpointInstances.push(instance);

        return instance;
    }

    function addDoc(
        method: OpenAPIV3.HttpMethods,
        path: string,
        { doc: endpointDoc }: EndpointInstance,
    ) {
        const convertedPath = convertPath(path);
        if (!router.doc[convertedPath]) {
            router.doc[convertedPath] = {};
        }
        router.doc[convertedPath]![method] = endpointDoc;
    }

    for (let method of Object.values(OpenAPIV3.HttpMethods)) {
        const copyRoute = (router as any)[method];
        // Would be great to be able to pass Endpoint or normal express RequestHandler
        (router as any)[method] = (path: string, ...endpoints: Endpoint[]) => {
            const instance = addEndpoint(method, path, ...endpoints);
            copyRoute.bind(router)(path, instance.handlers);
            addDoc(method, path, instance);
            return router;
        };
    }

    return router;
}
