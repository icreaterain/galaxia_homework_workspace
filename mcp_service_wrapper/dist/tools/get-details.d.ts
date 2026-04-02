import { z } from 'zod';
export declare const getDetailsInputSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type GetDetailsInput = z.infer<typeof getDetailsInputSchema>;
export declare function runGetDetails(input: GetDetailsInput, baseUrl: string): Promise<string>;
//# sourceMappingURL=get-details.d.ts.map