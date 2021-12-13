import { OpenAPIV3 } from 'openapi-types';

import { DocResponse } from './router';
import { Format } from './format';

interface SchemaObject extends Omit<OpenAPIV3.SchemaObject, 'required'> {
    required?: boolean;
}

interface Param extends OpenAPIV3.ParameterBaseObject {
    type?: OpenAPIV3.NonArraySchemaObjectType | Format<any>;
}

interface BodySchema extends Omit<SchemaObject, 'type'> {
    type?: SchemaObject['type'] | Format<any>;
}

export const pathParamMetadataKey = Symbol('pathParam');
export const bodyPropMetadataKey = Symbol('bodyProp');
export const docMetadataKey = Symbol('doc');
export const propsMetadataKey = Symbol('props');
export const errorResponseMetadataKey = Symbol('errorResponse');

export function getPropsMetadata(target: any) {
    return Reflect.getMetadata(propsMetadataKey, target) || [];
}

function propMetadata(metadataKey: any, metadataValue: any) {
    return function (target: any, propertyKey: string) {
        const props = getPropsMetadata(target);
        props.push(propertyKey);
        Reflect.defineMetadata(propsMetadataKey, [...new Set(props)], target);
        Reflect.defineMetadata(metadataKey, metadataValue, target, propertyKey);
    };
}

export function doc(doc: Omit<OpenAPIV3.OperationObject, 'responses'>) {
    return function (constructor: Function) {
        Reflect.defineMetadata(docMetadataKey, doc, constructor.prototype);
    };
}

export function pathParam(doc: Param) {
    return propMetadata(pathParamMetadataKey, { ...doc, in: 'path' });
}

export function queryParam(doc: Param) {
    return propMetadata(pathParamMetadataKey, { ...doc, in: 'query' });
}

export function bodyProp(doc: BodySchema) {
    return propMetadata(bodyPropMetadataKey, doc);
}

export function errorResponse(doc: DocResponse = {}) {
    return propMetadata(errorResponseMetadataKey, doc);
};
