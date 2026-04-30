import type { UIState } from '../../engine/ui/uiStateEngine';
import type { EngineActions } from '../../engine/useGameEngine';
import type { PendingOrder } from '../../engine/types/orders';

interface CommandPanelProps {
  ui: UIState;
  actions: EngineActions;
  pendingOrders: PendingOrder[];
}

const NON_TERMINAL = new Set(['issued', 'heard', 'acknowledged', 'in_progress']);

function mostRecentOpenOrder(orders: PendingOrder[]): PendingOrder | null {
  for (let i = orders.length - 1; i >= 0; i--) {
    if (NON_TERMINAL.has(orders[i].status)) return orders[i];
  }
  return null;
}

export default function CommandPanel({ ui, actions, pendingOrders }: CommandPanelProps) {
  const isShockable = ui.rhythm === 'vfib' || ui.rhythm === 'vtach';
  const hasAccess = ui.hasIVAccess || ui.hasIOAccess;
  const amioDose = ui.amiodaroneDoses === 0 ? 300 : 150;
  const openOrder = mostRecentOpenOrder(pendingOrders);

  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-lg p-2">
      <div className="text-[10px] text-gray-500 tracking-wider mb-2">CODE LEADER ACTIONS</div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={actions.startCpr}
          disabled={ui.cprActive}
          className={btn(ui.cprActive ? 'disabled' : 'red')}
        >
          {ui.cprActive ? 'CPR running' : 'Start CPR'}
        </button>

        <button onClick={actions.assignCompressor} className={btn('gray')}>
          Assign Compressor
        </button>

        <button onClick={actions.switchCompressor} className={btn('gray')}>
          Rotate Compressor
        </button>

        <button
          onClick={actions.chargeDefib}
          disabled={!isShockable || ui.defibCharged}
          className={btn(ui.defibCharged ? 'amberFilled' : isShockable ? 'amber' : 'disabled')}
        >
          {ui.defibCharged ? 'CHARGED 200J' : 'Charge Defib'}
        </button>

        <button
          onClick={actions.shock}
          disabled={!ui.defibCharged}
          className={btn(ui.defibCharged ? 'red' : 'disabled')}
        >
          SHOCK ({ui.shockCount})
        </button>

        <button
          onClick={() => actions.medication('epinephrine', 1)}
          className={btn(hasAccess ? 'blue' : 'amber')}
          title={hasAccess ? 'Epi 1mg q3-5min' : 'No vascular access yet'}
        >
          Give Epinephrine 1mg
        </button>

        <button
          onClick={() => actions.medication('amiodarone', amioDose)}
          className={btn(hasAccess ? 'blue' : 'amber')}
          title={hasAccess ? `${amioDose}mg` : 'No vascular access yet'}
        >
          Give Amiodarone {amioDose}mg
        </button>

        <button onClick={actions.rhythmCheck} className={btn('blue')}>
          Rhythm Check
        </button>

        <button onClick={actions.pulseCheck} className={btn('blue')}>
          Pulse Check
        </button>

        <button onClick={actions.airwayBvm} className={btn('blue')}>
          Manage Airway
        </button>

        <button
          onClick={() => openOrder && actions.requestClosedLoop(openOrder.id)}
          disabled={!openOrder}
          className={`col-span-2 ${btn(openOrder ? 'amber' : 'disabled')}`}
          title={openOrder ? `Confirm: ${openOrder.label}` : 'No open order to confirm'}
        >
          {openOrder
            ? `Ask for closed-loop on “${openOrder.label}”`
            : 'Ask for closed-loop confirmation'}
        </button>
      </div>

      {!hasAccess && (
        <div className="mt-2 text-[10px] text-amber-300/90 bg-amber-950/30 px-2 py-1 rounded leading-snug">
          ⚠ No vascular access yet — medications will be drawn but not given. Assign a team member
          to obtain IV/IO access.
        </div>
      )}
    </div>
  );
}

function btn(variant: 'red' | 'amber' | 'amberFilled' | 'blue' | 'gray' | 'disabled'): string {
  const base = 'text-[11px] px-2 py-1.5 rounded font-bold transition-colors text-left';
  switch (variant) {
    case 'red':
      return `${base} bg-red-900/60 text-red-200 hover:bg-red-800/70`;
    case 'amber':
      return `${base} bg-amber-900/40 text-amber-200 hover:bg-amber-800/60`;
    case 'amberFilled':
      return `${base} bg-amber-700 text-amber-50`;
    case 'blue':
      return `${base} bg-blue-900/40 text-blue-200 hover:bg-blue-800/60`;
    case 'gray':
      return `${base} bg-gray-800 text-gray-300 hover:bg-gray-700`;
    case 'disabled':
      return `${base} bg-gray-900/40 text-gray-600 cursor-not-allowed`;
  }
}
