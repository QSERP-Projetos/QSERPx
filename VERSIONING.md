# Controle de Versão do Sistema

## Como Alterar a Versão do Sistema

A versão do sistema QSERPx é controlada centralmente no arquivo:

📄 **`src/constants/appInfo.ts`**

### Passos para Atualizar a Versão

1. Abra o arquivo `src/constants/appInfo.ts`

2. Localize a propriedade `versions.web` dentro de `APP_IDENTITY`

3. Altere o valor da versão seguindo o padrão de versionamento semântico

**Exemplo:**

```typescript
export const APP_IDENTITY = {
  name: 'QSERPx',
  versions: {
    web: '2.9.2.8',  // ← Altere aqui
  },
} as const;
```

### Padrão de Versionamento

O sistema utiliza o formato: `MAJOR.MINOR.PATCH.BUILD`

- **MAJOR**: Mudanças incompatíveis na API ou grandes refatorações
- **MINOR**: Novas funcionalidades mantendo compatibilidade
- **PATCH**: Correções de bugs
- **BUILD**: Número incremental de build/deploy

### Exemplos de Alteração

- **Nova funcionalidade**: `2.9.2.8` → `2.10.0.0`
- **Correção de bug**: `2.9.2.8` → `2.9.2.9`
- **Breaking change**: `2.9.2.8` → `3.0.0.0`
- **Build incremental**: `2.9.2.8` → `2.9.2.9`

### Após Alterar a Versão

1. Salve o arquivo
2. Reconstrua o projeto: `npm run build`
3. Verifique se a nova versão está aparecendo corretamente no sistema

### Onde a Versão é Exibida

A versão é exportada e pode ser importada em qualquer parte do sistema:

```typescript
import { APP_VERSION } from '@/constants/appInfo';
```

### ⚠️ Importante

- **NÃO** altere a versão no `package.json` (ela é usada apenas como versão do pacote Node.js)
- A versão do sistema deve ser alterada **SOMENTE** no `appInfo.ts`
- Mantenha sempre o padrão de 4 números separados por ponto
