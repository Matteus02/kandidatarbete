<script setup lang="ts">
import { CircuitNode, NODE_WIDTH, NODE_HEIGHT, HORIZONTAL_SPACING, PARALLEL_SPACING } from '@/utils/CircuitNode'
import ResistorSymbol from './symbols/ResistorSymbol.vue'
import CapacitorSymbol from './symbols/CapacitorSymbol.vue'
import CpeSymbol from './symbols/CpeSymbol.vue'
import WarburgSymbol from './symbols/WarburgSymbol.vue'
import WarburgOpenSymbol from './symbols/WarburgOpenSymbol.vue'
import WarburgShortSymbol from './symbols/WarburgShortSymbol.vue'
import InductorSymbol from './symbols/InductorSymbol.vue'
import { ref, inject, computed } from 'vue'
import type { Ref } from 'vue'

const props = defineProps<{
    node: CircuitNode;
    x: number;
    y: number;
}>()

const getVerticalOffset = computed(() => {
  if (!props.node) return 0;
  const upperH = props.node.upperBranch?.countMaxHeight() || NODE_HEIGHT;
  const lowerH = props.node.lowerBranch?.countMaxHeight() || NODE_HEIGHT;
  return Math.max(upperH, lowerH) / 2 + PARALLEL_SPACING;
});

const handleNodeDrop = inject<(target: CircuitNode, type: string, action: 'before' | 'replace' | 'after') => void>('handleNodeDrop')
const insertIntoEmptyBranch = inject<(parent: CircuitNode, branch: 'upper' | 'lower', type: string) => void>('insertIntoEmptyBranch')

const hoverState = ref<'before' | 'replace' | 'after' | null>(null)
const emptyBranchHover = ref<'upper' | 'lower' | null>(null)

const onDrop = (event: DragEvent, action: 'before' | 'replace' | 'after') => {
  hoverState.value = null;
  const type = event.dataTransfer?.getData('componentType');
  const finalAction = (!props.node || props.node.type === 'empty') ? 'replace' : action;
  if (type && handleNodeDrop) {
    handleNodeDrop(props.node, type, finalAction);
  }
}

const onEmptyDrop = (event: DragEvent, branch: 'upper' | 'lower') => {
  emptyBranchHover.value = null
  const type = event.dataTransfer?.getData('componentType');
  if (type && insertIntoEmptyBranch) {
    insertIntoEmptyBranch(props.node, branch, type);
  }
}

const deleteNode = inject<(n: CircuitNode) => void>('deleteNode')
const isDragging = inject<Ref<boolean>>('isDragging', ref(false))

const handleRemove = () => {
    if (deleteNode && props.node) {
        deleteNode(props.node);
    }
};
</script>

<template>
    <g v-if="!node || node.type === 'empty'" :transform="`translate(${x}, ${y})`">
        <rect x="0" y="-20" width="120" height="40" rx="5"
              fill="rgba(59,130,246,0.05)" stroke="#3b82f6" stroke-dasharray="4,4"
              cursor="pointer"
              @dragover.prevent @dragenter.prevent="hoverState = 'replace'"
              @dragleave="hoverState = null"
              @drop.stop.prevent="onDrop($event, 'replace')" />
        <text x="60" y="4" text-anchor="middle" font-size="11" fill="#3b82f6" pointer-events="none">
            Dra komponent hit
        </text>
        <rect v-if="hoverState === 'replace'" x="0" y="-20" width="120" height="40" rx="5"
              fill="rgba(59,130,246,0.15)" stroke="#3b82f6" pointer-events="none" />
    </g>

    <g v-else :transform="`translate(${x}, ${y})`">

        <g class="drop-zone-before" v-show="isDragging">
            <rect x="-19" y="-13" width="16" height="26" rx="3"
              :fill="hoverState === 'before' ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.06)'"
              :stroke="hoverState === 'before' ? '#3b82f6' : '#ccc'"
              stroke-width="1" stroke-dasharray="3,2"
              pointer-events="none" />
            <text x="-11" y="4" text-anchor="middle" font-size="10"
              :fill="hoverState === 'before' ? '#3b82f6' : '#bbb'"
              font-weight="bold" pointer-events="none">+</text>
            <rect x="-25" y="-25" width="25" height="50" fill="transparent" cursor="pointer"
              @dragover.prevent @dragenter.prevent="hoverState = 'before'"
              @dragleave="hoverState = null" @drop.stop.prevent="onDrop($event, 'before')" />
        </g>

        <g v-if="['R', 'C', 'CPE', 'W', 'Wo', 'Ws', 'L'].includes(node.type)" class="component-wrapper" @click.stop="handleRemove" @dragleave="hoverState = null">

            <ResistorSymbol v-if="node.type === 'R'" :label="`${node.id}`" />
            <CapacitorSymbol v-else-if="node.type === 'C'" :label="`${node.id}`" />
            <CpeSymbol v-else-if="node.type === 'CPE'" :label="`${node.id}`" />
            <WarburgSymbol v-else-if="node.type === 'W'" :label="`${node.id}`" />
            <WarburgOpenSymbol v-else-if="node.type === 'Wo'" :label="`${node.id}`" />
            <WarburgShortSymbol v-else-if="node.type === 'Ws'" :label="`${node.id}`" />
            <InductorSymbol v-else-if="node.type === 'L'" :label="`${node.id}`" />

            <rect x="0" y="-25" :width="node.countLength()" height="50" fill="transparent"
              @dragover.prevent @dragenter.prevent="hoverState = 'replace'"
              @drop.stop.prevent="onDrop($event, 'replace')" />

            <rect x="0" y="-25" :width="node.countLength()" height="50" rx="4" class="hover-box" pointer-events="none" />
            <rect v-if="hoverState === 'replace'" x="0" y="-25" :width="node.countLength()" height="50"
              fill="rgba(59,130,246,0.18)" stroke="#3b82f6" stroke-width="1" rx="4" pointer-events="none" />
        </g>

        <g v-else-if="node.type === 'parallel'" class="component-wrapper" @click.stop="handleRemove" @dragleave="hoverState = null">

            <rect x="-5" :y="-getVerticalOffset - 5" :width="node.countLength() + 10" :height="getVerticalOffset*2 + 10"
              fill="transparent"
              @dragover.prevent @dragenter.prevent="hoverState = 'replace'"
              @drop.stop.prevent="onDrop($event, 'replace')" />

            <rect x="-5" :y="-getVerticalOffset - 5" :width="node.countLength() + 10" :height="getVerticalOffset*2 + 10"
              rx="6" class="hover-box" pointer-events="none" />

            <rect v-if="hoverState === 'replace'" x="-5" :y="-getVerticalOffset - 5" :width="node.countLength() + 10" :height="getVerticalOffset*2 + 10"
              fill="rgba(59,130,246,0.18)" stroke="#3b82f6" stroke-width="1" rx="6" pointer-events="none" />

            <line x1="0" :y1="-getVerticalOffset" x2="0" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
            <line :x1="node.countLength()" :y1="-getVerticalOffset" :x2="node.countLength()" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />

            <g class="branchContainer">
                <template v-if="node.upperBranch">
                    <template v-if="(node.upperBranch?.countMaxLength() ?? NODE_WIDTH - 1) < (node.lowerBranch?.countMaxLength() ?? NODE_WIDTH - 1)">
                        <CircuitRenderer :node="node.upperBranch" :x="(node.lowerBranch?.countMaxLength() ?? NODE_WIDTH - 1)/2-node.upperBranch.countMaxLength()/2 + HORIZONTAL_SPACING" :y="-getVerticalOffset" />
                        <line x1="0" :y1="-getVerticalOffset" :x2="(node.lowerBranch?.countMaxLength() ?? NODE_WIDTH - 1)/2-node.upperBranch.countMaxLength()/2 + HORIZONTAL_SPACING" :y2="-getVerticalOffset" stroke="#333" stroke-width="2" />
                        <line :x1="(node.lowerBranch?.countMaxLength() ?? NODE_WIDTH - 1)/2+node.upperBranch.countMaxLength()/2 + HORIZONTAL_SPACING" :y1="-getVerticalOffset" :x2="node.countLength()" :y2="-getVerticalOffset" stroke="#333" stroke-width="2" />
                    </template>
                    <template v-else>
                        <CircuitRenderer :node="node.upperBranch" :x="HORIZONTAL_SPACING" :y="-getVerticalOffset" />
                        <line x1="0" :y1="-getVerticalOffset" :x2="HORIZONTAL_SPACING" :y2="-getVerticalOffset" stroke="#333" stroke-width="2" />
                        <line :x1="node.upperBranch.countMaxLength() + HORIZONTAL_SPACING" :y1="-getVerticalOffset" :x2="node.countLength()" :y2="-getVerticalOffset" stroke="#333" stroke-width="2" />
                    </template>
                </template>
                <template v-else>
                    <line x1="0" :y1="-getVerticalOffset" :x2="node.countLength()" :y2="-getVerticalOffset" stroke="#333" stroke-width="2" />
                    <g v-show="isDragging">
                        <rect :x="node.countLength()/2 - 15" :y="-getVerticalOffset - 10" width="30" height="20" rx="3"
                              :fill="emptyBranchHover === 'upper' ? 'rgba(59,130,246,0.12)' : 'rgba(0,0,0,0.03)'"
                              :stroke="emptyBranchHover === 'upper' ? '#3b82f6' : '#ccc'"
                              stroke-width="1" stroke-dasharray="3,2" pointer-events="none" />
                        <rect :x="node.countLength()/2 - 20" :y="-getVerticalOffset - 20" width="40" height="40" fill="transparent" cursor="pointer"
                              @dragover.prevent @dragenter.prevent="emptyBranchHover = 'upper'"
                              @dragleave="emptyBranchHover = null" @drop.stop.prevent="onEmptyDrop($event, 'upper')" />
                    </g>
                </template>
            </g>

            <g class="branchContainer">
                <template v-if="node.lowerBranch">
                    <template v-if="(node.upperBranch?.countMaxLength() ?? NODE_WIDTH - 1) > (node.lowerBranch?.countMaxLength() ?? NODE_WIDTH - 1)">
                        <CircuitRenderer :node="node.lowerBranch" :x="(node.upperBranch?.countMaxLength() ?? NODE_WIDTH - 1)/2-node.lowerBranch.countMaxLength()/2 + HORIZONTAL_SPACING" :y="getVerticalOffset" />
                        <line x1="0" :y1="getVerticalOffset" :x2="(node.upperBranch?.countMaxLength() ?? NODE_WIDTH - 1)/2-node.lowerBranch.countMaxLength()/2 + HORIZONTAL_SPACING" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                        <line :x1="(node.upperBranch?.countMaxLength() ?? NODE_WIDTH - 1)/2+node.lowerBranch.countMaxLength()/2 + HORIZONTAL_SPACING" :y1="getVerticalOffset" :x2="node.countLength()" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                    </template>
                    <template v-else>
                        <CircuitRenderer :node="node.lowerBranch" :x="HORIZONTAL_SPACING" :y="getVerticalOffset" />
                        <line x1="0" :y1="getVerticalOffset" :x2="HORIZONTAL_SPACING" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                        <line :x1="node.lowerBranch.countMaxLength() + HORIZONTAL_SPACING" :y1="getVerticalOffset" :x2="node.countLength()" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                    </template>
                </template>
                <template v-else>
                    <line x1="0" :y1="getVerticalOffset" :x2="node.countLength()" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                    <g v-show="isDragging">
                        <rect :x="node.countLength()/2 - 15" :y="getVerticalOffset - 10" width="30" height="20" rx="3"
                              :fill="emptyBranchHover === 'lower' ? 'rgba(59,130,246,0.12)' : 'rgba(0,0,0,0.03)'"
                              :stroke="emptyBranchHover === 'lower' ? '#3b82f6' : '#ccc'"
                              stroke-width="1" stroke-dasharray="3,2" pointer-events="none" />
                        <rect :x="node.countLength()/2 - 20" :y="getVerticalOffset - 20" width="40" height="40" fill="transparent" cursor="pointer"
                              @dragover.prevent @dragenter.prevent="emptyBranchHover = 'lower'"
                              @dragleave="emptyBranchHover = null" @drop.stop.prevent="onEmptyDrop($event, 'lower')" />
                    </g>
                </template>
            </g>
        </g>

        <g v-if="!node.next || node.next.type === 'end'" v-show="isDragging" class="drop-zone-after" :transform="`translate(${node.countLength() + 3}, 0)`">
            <rect x="0" y="-13" width="16" height="26" rx="3"
              :fill="hoverState === 'after' ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.06)'"
              :stroke="hoverState === 'after' ? '#3b82f6' : '#ccc'"
              stroke-width="1" stroke-dasharray="3,2"
              pointer-events="none" />
            <text x="8" y="4" text-anchor="middle" font-size="10"
              :fill="hoverState === 'after' ? '#3b82f6' : '#bbb'"
              font-weight="bold" pointer-events="none">+</text>
            <rect x="0" y="-25" width="25" height="50" fill="transparent" cursor="pointer"
              @dragover.prevent @dragenter.prevent="hoverState = 'after'"
              @dragleave="hoverState = null" @drop.stop.prevent="onDrop($event, 'after')" />
        </g>

        <template v-if="node.next && node.next.type !== 'end'">
            <line
              :x1="node.countLength()" y1="0"
              :x2="node.countLength() + HORIZONTAL_SPACING" y2="0"
              stroke="#333" stroke-width="2"
            />
            <CircuitRenderer :node="node.next" :x="node.countLength() + HORIZONTAL_SPACING" :y="0" />
        </template>
    </g>
</template>

<style scoped>
.hover-box {
  fill: rgba(0, 0, 0, 0.04);
  stroke: rgba(0, 0, 0, 0.08);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.component-wrapper:hover > .hover-box {
  opacity: 1;
}

.component-wrapper:has(.component-wrapper:hover) > .hover-box {
  opacity: 0 !important;
}
</style>
