import { NextFunction, Request, Response } from 'express';
import { OpenAPIV3 } from 'openapi-types';

import { Format } from './format';
import {
    bodyPropMetadataKey,
    docMetadataKey,
    errorResponseMetadataKey,
    getPropsMetadata,
    pathParamMetadataKey,
} from './endpoint.decorator';

interface HttpError extends Error {
    statusCode: number;
}

export abstract class Endpoint {
    private _doc!: OpenAPIV3.OperationObject;
    private _formatters: { [format: string]: Format<any> } = {};

    req!: Request;
    res!: Response;
    next!: NextFunction;

    abstract handler(): void | Promise<void>;

    private _getType(propType: any) {
        // need to handle multiple types!!!
        // here we might need a smarter way to convert type to json schema
        return propType.name.toLowerCase();
    }

    private _setDocErrorResponse(name: string) {
        const errorDoc = Reflect.getMetadata(
            errorResponseMetadataKey,
            this,
            name,
        );
        if (!errorDoc) {
            return false;
        }
        const error = (this as any)[name];
        if (error instanceof Error) {
            this._doc.responses[(error as HttpError).statusCode || 500] = {
                description: error.message,
                content: {
                    'application/json': {},
                },
                ...errorDoc,
            };
        }
        return true;
    }

    private _setDocParameter(name: string, propType: any) {
        const pathParam = Reflect.getMetadata(pathParamMetadataKey, this, name);
        if (!pathParam) {
            return false;
        }

        if (pathParam.type) {
            if (pathParam.type instanceof Format) {
                const { schema } = pathParam.type;
                pathParam.schema = schema;
                this._formatters[schema.format] = pathParam.type;
            } else {
                pathParam.schema = {
                    type: pathParam.type,
                };
            }
            delete pathParam.type;
        }
        if (!pathParam.schema) {
            pathParam.schema = {
                type: this._getType(propType),
            };
        }
        this._doc.parameters!.push({
            name,
            ...pathParam,
        });
        return true;
    }

    private _setDocBodyProp(name: string, propType: any) {
        const bodyProp = Reflect.getMetadata(bodyPropMetadataKey, this, name);
        if (!bodyProp) {
            return false;
        }
        if (!this._doc.requestBody) {
            this._doc.requestBody = {
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {},
                            required: [],
                        },
                    },
                },
            };
        }
        const bodySchema = this._getBodySchema();
        if (bodySchema?.type === 'object') {
            let { required, ...prop } = bodyProp;
            if (!prop.type) {
                prop.type = this._getType(propType);
            } else if (prop.type instanceof Format) {
                const { schema } = prop.type;
                prop = { ...prop, schema };
                this._formatters[schema.format] = prop.type;
            }
            bodySchema.properties = {
                ...bodySchema.properties,
                [name]: prop,
            };
            if (required) {
                bodySchema.required = [...(bodySchema.required || []), name];
            }
        }
        return true;
    }

    private _getBodySchema() {
        return (this._doc.requestBody as OpenAPIV3.RequestBodyObject)?.content[
            'application/json'
        ]?.schema as OpenAPIV3.SchemaObject;
    }

    public get doc(): OpenAPIV3.OperationObject {
        if (this._doc) {
            return this._doc;
        }

        this._doc = Reflect.getMetadata(docMetadataKey, this) || {};

        if (!this._doc.responses) {
            this._doc.responses = {
                '200': {
                    description: 'Success',
                    content: {
                        'application/json': {},
                    },
                },
            };
        }

        this._doc.parameters = this._doc.parameters || [];
        for (const name of getPropsMetadata(this)) {
            // need to handle multiple types!!!
            const propType = Reflect.getMetadata('design:type', this, name);
            !this._setDocErrorResponse(name) &&
                !this._setDocParameter(name, propType) &&
                this._setDocBodyProp(name, propType);
        }

        return this._doc;
    }

    public handle(req: Request, res: Response, next: NextFunction) {
        this.req = req;
        this.res = res;
        this.next = next;
        this._assignQueryParamsProps();
        this._assignBodyProps();
        // return promise if handle is async
        return this.handler();
    }

    private _assignQueryParamsProps() {
        const values = { ...this.req.params, ...this.req.query };
        const parameters = this.doc.parameters as OpenAPIV3.ParameterObject[];
        parameters.forEach(({ name, schema }) => {
            this._assignProp(values, name, schema as OpenAPIV3.SchemaObject);
        });
    }

    private _assignBodyProps() {
        const bodySchema = this._getBodySchema();
        if (bodySchema?.type === 'object' && bodySchema.properties) {
            for (const name in bodySchema.properties) {
                this._assignProp(
                    this.req.body,
                    name,
                    bodySchema.properties[name] as OpenAPIV3.SchemaObject,
                );
            }
        }
    }

    private _assignProp(
        values: any,
        key: string,
        { type, format }: OpenAPIV3.SchemaObject = {},
    ) {
        let value: any = values[key];
        if (value !== undefined) {
            if (format && this._formatters[format]) {
                value = this._formatters[format].formatter(value);
            } else if (type === 'number' || type === 'integer') {
                value = Number(value);
            }
        }
        // might find something better!!
        (this as any)[key] = value;
    }
}
