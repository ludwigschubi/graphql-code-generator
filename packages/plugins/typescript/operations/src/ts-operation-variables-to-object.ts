import { TypeScriptOperationVariablesToObject as TSOperationVariablesToObject } from 'webql-codegen-typescript';

export class TypeScriptOperationVariablesToObject extends TSOperationVariablesToObject {
  protected formatTypeString(fieldType: string, isNonNullType: boolean, hasDefaultValue: boolean): string {
    return fieldType;
  }
}
