'use strict';

const { internalFetch } = require('../../shared/utils/internal-http.js');
const { randomId } = require('../../shared/utils/ids.js');

function vendorRecordActions(env) {
  const { USER_SERVICE_URL, INTERNAL_SHARED_SECRET } = env;

  async function patchVendor(action, vendorId, actorEmail) {
    return internalFetch({
      baseUrl: USER_SERVICE_URL,
      path: `/internal/admin/vendors/${encodeURIComponent(vendorId)}/${action}`,
      method: 'PATCH',
      body: { actorEmail },
      callerService: 'admin-service',
      secret: INTERNAL_SHARED_SECRET,
      requestId: randomId('adm'),
      timeoutMs: 15000
    });
  }

  return {
    approveVendor: {
      actionType: 'record',
      icon: 'Check',
      component: false,
      isAccessible: () => true,
      handler: async (_request, _response, context) => {
        const record = context.record;
        const vendorId = record.param('id');
        const actorEmail = context.currentAdmin?.email || '';
        if (!vendorId) {
          return { record: record.toJSON(context.currentAdmin), notice: { message: 'ID manquant', type: 'error' } };
        }
        const result = await patchVendor('approve', vendorId, actorEmail);
        const msg =
          result.payload?.error?.message ||
          (result.ok ? 'Vendeur approuvé (audit security_events)' : 'Échec approbation');
        return {
          record: record.toJSON(context.currentAdmin),
          notice: { message: msg, type: result.ok ? 'success' : 'error' }
        };
      }
    },
    rejectVendor: {
      actionType: 'record',
      icon: 'X',
      component: false,
      isAccessible: () => true,
      handler: async (_request, _response, context) => {
        const record = context.record;
        const vendorId = record.param('id');
        const actorEmail = context.currentAdmin?.email || '';
        if (!vendorId) {
          return { record: record.toJSON(context.currentAdmin), notice: { message: 'ID manquant', type: 'error' } };
        }
        const result = await patchVendor('reject', vendorId, actorEmail);
        const msg =
          result.payload?.error?.message ||
          (result.ok ? 'Vendeur rejeté (audit security_events)' : 'Échec rejet');
        return {
          record: record.toJSON(context.currentAdmin),
          notice: { message: msg, type: result.ok ? 'success' : 'error' }
        };
      }
    }
  };
}

const hiddenHashProps = {
  access_token_hash: { isVisible: { list: false, show: false, filter: false, edit: false } },
  refresh_token_hash: { isVisible: { list: false, show: false, filter: false, edit: false } }
};

function buildSqlResources(db, env) {
  return [
    {
      resource: db.table('users'),
      options: {
        navigation: { name: 'Users & Vendors' },
        properties: {
          email: { isTitle: true }
        }
      }
    },
    {
      resource: db.table('vendors'),
      options: {
        navigation: { name: 'Users & Vendors' },
        properties: {
          email: { isTitle: true },
          approval_status: {
            availableValues: [
              { value: 'pending', label: 'En attente' },
              { value: 'approved', label: 'Approuvé' },
              { value: 'rejected', label: 'Rejeté' }
            ]
          }
        },
        actions: vendorRecordActions(env)
      }
    },
    {
      resource: db.table('orders'),
      options: { navigation: { name: 'Orders' } }
    },
    {
      resource: db.table('order_items'),
      options: { navigation: { name: 'Orders' } }
    },
    {
      resource: db.table('sessions'),
      options: {
        navigation: { name: 'Security' },
        properties: hiddenHashProps
      }
    },
    {
      resource: db.table('security_events'),
      options: { navigation: { name: 'Security' } }
    },
    {
      resource: db.table('blocked_ips'),
      options: { navigation: { name: 'Security' } }
    }
  ];
}

module.exports = { buildSqlResources };
