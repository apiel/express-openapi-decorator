import { OpenAPIV3 } from 'openapi-types';

// https://swagger.io/docs/specification/data-models/data-types

export abstract class Format<ReturnType> {
    abstract schema: OpenAPIV3.SchemaObject;
    abstract formatter(value: any): ReturnType;
}

export class DateTimeFormat extends Format<Date | undefined> {
    schema = { type: 'string', format: 'date-time' } as OpenAPIV3.NonArraySchemaObject;

    formatter(value: any) {
        if (value) {
            const date = new Date(value);
            if (date.toString() === 'Invalid Date') {
                throw new Error('Invalid Date');
            }
            return date;
        }
    }
}
