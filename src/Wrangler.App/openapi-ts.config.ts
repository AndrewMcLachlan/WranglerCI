import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
    input: '../Wrangler.Api/openapi-v1.json',
    output: './src/api',
    plugins: [
        {
            name: '@hey-api/client-axios',
            runtimeConfigPath: '../utils/axios-config.ts',
        },
        {
            name: '@tanstack/react-query',
            queryOptions: true,
            useQuery: true,
            mutationOptions: true,
            infiniteQueryOptions: false,
        }
    ],
});
