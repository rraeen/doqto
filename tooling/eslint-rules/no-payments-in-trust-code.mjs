// TDD 5.8: reviews and ranking code must never import the payments module or
// any future subscriptions module, so paid ranking is structurally impossible.
// Applied (see eslint.config.mjs) to apps/api/src/reviews/**, ranking/**,
// search/** and any *ranking* file under apps/api/src.
import path from 'node:path';

const API_SRC = `${path.sep}apps${path.sep}api${path.sep}src${path.sep}`;

const FORBIDDEN_MODULES = ['payments', 'subscriptions'];

function forbiddenDirsFor(filename) {
  const idx = filename.lastIndexOf(API_SRC);
  if (idx === -1) return [];
  const src = filename.slice(0, idx + API_SRC.length);
  return FORBIDDEN_MODULES.map((m) => path.join(src, m));
}

function isPaymentsSpecifier(specifier, filename) {
  if (typeof specifier !== 'string') return false;
  if (specifier.startsWith('.')) {
    const resolved = path.resolve(path.dirname(filename), specifier);
    return forbiddenDirsFor(filename).some(
      (dir) => resolved === dir || resolved.startsWith(dir + path.sep),
    );
  }
  // Aliases such as `src/payments`, `@/payments/x`, `@payments/x`,
  // `@doqto/api/subscriptions`, and gateway SDKs, which belong only to payments.
  if (/^razorpay(\/|$)/.test(specifier)) return true;
  return specifier
    .split('/')
    .some((segment) => FORBIDDEN_MODULES.includes(segment.replace(/^@/, '')));
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Reviews and ranking code must not import payments or subscriptions (TDD 5.8)',
    },
    schema: [],
    messages: {
      forbidden:
        "'{{specifier}}' is payments or subscriptions code. Reviews, ranking and search must never import it (TDD 5.8).",
    },
  },
  create(context) {
    const filename = context.filename;
    const check = (node, source) => {
      if (source && source.type === 'Literal' && isPaymentsSpecifier(source.value, filename)) {
        context.report({ node, messageId: 'forbidden', data: { specifier: source.value } });
      }
    };
    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
      TSImportEqualsDeclaration: (node) => {
        if (node.moduleReference.type === 'TSExternalModuleReference') {
          check(node, node.moduleReference.expression);
        }
      },
      TSImportType: (node) => {
        const arg = node.argument;
        check(node, arg && arg.type === 'TSLiteralType' ? arg.literal : arg);
      },
      CallExpression: (node) => {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          check(node, node.arguments[0]);
        }
      },
    };
  },
};

export default rule;
