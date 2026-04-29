<script setup lang="ts">
// Drag-and-drop palette that lists every available circuit element.
// Each item sets its element type via the HTML5 Drag API (dataTransfer)
// so CircuitRenderer can receive it in its drop handlers.

import ResistorSymbol     from './symbols/ResistorSymbol.vue'
import CapacitorSymbol    from './symbols/CapacitorSymbol.vue'
import CpeSymbol          from './symbols/CpeSymbol.vue'
import WarburgSymbol      from './symbols/WarburgSymbol.vue'
import WarburgOpenSymbol  from './symbols/WarburgOpenSymbol.vue'
import WarburgShortSymbol from './symbols/WarburgShortSymbol.vue'
import InductorSymbol     from './symbols/InductorSymbol.vue'
import ParallellSymbol    from './symbols/ParallellSymbol.vue'

const ITEMS = [
  { type: 'R',        label: 'Resistor'   },
  { type: 'C',        label: 'Capacitor'  },
  { type: 'CPE',      label: 'CPE'        },
  { type: 'W',        label: 'Warburg'    },
  { type: 'Wo',       label: 'Warburg O'  },
  { type: 'Ws',       label: 'Warburg S'  },
  { type: 'L',        label: 'Inductor'   },
  { type: 'parallel', label: 'Parallel'   },
] as const

function onDragStart(event: DragEvent, type: string) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('componentType', type)
    event.dataTransfer.effectAllowed = 'copy'
  }
}
</script>

<template>
  <div class="palette">
    <div
      v-for="item in ITEMS"
      :key="item.type"
      class="palette-item"
      draggable="true"
      @dragstart="onDragStart($event, item.type)"
    >
      <svg width="100" height="46" style="overflow: visible; pointer-events: none">
        <g transform="translate(20, 23)">
          <ResistorSymbol      v-if="item.type === 'R'"        label="" />
          <CapacitorSymbol     v-else-if="item.type === 'C'"   label="" />
          <CpeSymbol           v-else-if="item.type === 'CPE'" label="" />
          <WarburgSymbol       v-else-if="item.type === 'W'"   label="" />
          <WarburgOpenSymbol   v-else-if="item.type === 'Wo'"  label="" />
          <WarburgShortSymbol  v-else-if="item.type === 'Ws'"  label="" />
          <InductorSymbol      v-else-if="item.type === 'L'"   label="" />
          <ParallellSymbol     v-else-if="item.type === 'parallel'" />
        </g>
      </svg>
      <span class="palette-label">{{ item.label }}</span>
    </div>

    <div class="instructions">
      <p><strong>Start:</strong> Drag any element onto the dashed box.</p>
      <p><strong>Series:</strong> Drop onto a <kbd>+</kbd> icon to insert before or after.</p>
      <p><strong>Parallel:</strong> Add a Parallel block, then drop into its "drop here" zones.</p>
      <p><strong>Replace:</strong> Drop directly onto an element to swap it out.</p>
      <p><strong>Delete:</strong> Click on any element to remove it.</p>
    </div>
  </div>
</template>

<style scoped>
.palette {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
  align-items: flex-start;
}

.palette-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f8f8f8;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  transition: background-color 0.15s;
}

.palette-item:hover {
  background: #eef4ff;
  border-color: #007bff;
}

.palette-label {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

.instructions {
  font-size: 11px;
  color: #555;
  max-width: 280px;
  line-height: 1.6;
}

.instructions p { margin: 2px 0; }
</style>
