import { z } from 'zod';
export declare const listInputSchema: z.ZodObject<{
    filter: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    filter?: string | undefined;
}, {
    filter?: string | undefined;
}>;
export type ListInput = z.infer<typeof listInputSchema>;
export declare function runList(input: ListInput, baseUrl: string): Promise<string>;
//# sourceMappingURL=list.d.ts.map