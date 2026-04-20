<script setup lang="ts">
import { CircuitNode } from '@/components/circuit/CircuitNode'
import ResistorSymbol from './ResistorSymbol.vue'
import CapacitorSymbol from './CapacitorSymbol.vue'
import CpeSymbol from './CpeSymbol.vue'
import WarburgSymbol from './WarburgSymbol.vue'
import { ref, inject, computed } from 'vue'
import type { ElementType } from '@/components/circuit/CircuitNode'

const props = defineProps<{
    node: CircuitNode;
    x: number;
    y: number;
}>()

const getVerticalOffset = computed(() => {
  const upperH = props.node.upperBranch?.countHeight() || nodeHeight / 2;
  const lowerH = props.node.lowerBranch?.countHeight() || nodeHeight / 2;
  return Math.max(upperH, lowerH) / 2 + parallelHeight;
});

const handleNodeDrop = inject<(target: CircuitNode, type: string, action: 'before' | 'replace' | 'after') => void>('handleNodeDrop')
const insertIntoEmptyBranch = inject<(parent: CircuitNode, branch: 'upper' | 'lower', type: string) => void>('insertIntoEmptyBranch')

const hoverState = ref<'before' | 'replace' | 'after' | null>(null)
const emptyBranchHover = ref<'upper' | 'lower' | null>(null)

const onDrop = (event: DragEvent, action: 'before' | 'replace' | 'after') => {
  hoverState.value = null;
  const type = event.dataTransfer?.getData('componentType');
  if (type && handleNodeDrop) {
    handleNodeDrop(props.node, type, action);
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

const handleRemove = () => {
    if (deleteNode) {
        deleteNode(props.node);
    }
};

const nodeWidth = 60;
const nodeHeight = 38;
const parallelHeight = 21;
const horizontalSpacing = 30;
</script>

<template>
    <g :transform="`translate(${x}, ${y})`">
        <g v-if="['R', 'C', 'CPE', 'W'].includes(node.type)" class="component-wrapper" @click.stop="handleRemove" @dragleave="hoverState = null">

            <!-- Component symbol -->
            <template v-if="node.type === 'R'">
                <ResistorSymbol :label="`${node.id}`" />
            </template>
            <template v-else-if="node.type === 'C'">
                <CapacitorSymbol :label="`${node.id}`" />
            </template>
            <template v-else-if="node.type === 'CPE'">
                <CpeSymbol :label="`${node.id}`" />
            </template>
            <template v-else-if="node.type === 'W'">
                <WarburgSymbol :label="`${node.id}`" />
            </template>

            <!-- Always-visible BEFORE slot indicator -->
            <rect x="-19" y="-13" width="16" height="26" rx="3"
              :fill="hoverState === 'before' ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.06)'"
              :stroke="hoverState === 'before' ? '#3b82f6' : '#ccc'"
              stroke-width="1" stroke-dasharray="3,2"
              pointer-events="none" />
            <text x="-11" y="4" text-anchor="middle" font-size="10"
              :fill="hoverState === 'before' ? '#3b82f6' : '#bbb'"
              font-weight="bold" pointer-events="none">+</text>

            <!-- Always-visible AFTER slot indicator -->
            <rect x="63" y="-13" width="16" height="26" rx="3"
              :fill="hoverState === 'after' ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.06)'"
              :stroke="hoverState === 'after' ? '#3b82f6' : '#ccc'"
              stroke-width="1" stroke-dasharray="3,2"
              pointer-events="none" />
            <text x="71" y="4" text-anchor="middle" font-size="10"
              :fill="hoverState === 'after' ? '#3b82f6' : '#bbb'"
              font-weight="bold" pointer-events="none">+</text>

            <!-- Invisible hit areas for drops -->
            <rect x="-20" y="-25" width="20" height="50" fill="transparent"
              @dragover.prevent @dragenter.prevent="hoverState = 'before'" @drop.stop.prevent="onDrop($event, 'before')" />
            <rect x="0" y="-25" width="60" height="50" fill="transparent"
              @dragover.prevent @dragenter.prevent="hoverState = 'replace'" @drop.stop.prevent="onDrop($event, 'replace')" />
            <rect x="60" y="-25" width="20" height="50" fill="transparent"
              @dragover.prevent @dragenter.prevent="hoverState = 'after'" @drop.stop.prevent="onDrop($event, 'after')" />

            <!-- Hover overlay on component body -->
            <rect x="0" y="-25" width="60" height="50" rx="4" class="hover-box" />
            <rect v-if="hoverState === 'replace'" x="0" y="-25" width="60" height="50"
              fill="rgba(59,130,246,0.18)" stroke="#3b82f6" stroke-width="1" rx="4" pointer-events="none" />

        </g>

        <template v-else-if="node.type === 'parallel'">
            <g class="component-wrapper" @click.stop="handleRemove">
                <rect
                  x="-5"
                  :y="-getVerticalOffset - 5"
                  :width="node.countLength() + 10"
                  :height="getVerticalOffset*2 + 10"
                  rx="6"
                  class="hover-box"
                />

                <line x1="0" :y1="-getVerticalOffset" x2="0" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                <line :x1="node.countLength()" :y1="-getVerticalOffset" :x2="node.countLength()" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />

                <!-- Upper branch -->
                <g class="branchContainer">
                    <template v-if="node.upperBranch">
                        <template v-if="(node.upperBranch?.countMaxLength() ?? nodeWidth - 1) < (node.lowerBranch?.countMaxLength() ?? nodeWidth - 1)">
                            <CircuitRenderer :node="node.upperBranch" :x="(node.lowerBranch?.countMaxLength() ?? nodeWidth - 1)/2-node.upperBranch.countMaxLength()/2 + horizontalSpacing" :y="-getVerticalOffset" />
                            <line x1="0" :y1="-getVerticalOffset" :x2="(node.lowerBranch?.countMaxLength() ?? nodeWidth - 1)/2-node.upperBranch.countMaxLength()/2 + horizontalSpacing" :y2="-getVerticalOffset" stroke="#333" stroke-width="2" />
                            <line :x1="(node.lowerBranch?.countMaxLength() ?? nodeWidth - 1)/2+node.upperBranch.countMaxLength()/2 + horizontalSpacing" :y1="-getVerticalOffset" :x2="node.countLength()" :y2="-getVerticalOffset" stroke="#333" stroke-width="2" />
                        </template>
                        <template v-else>
                            <CircuitRenderer :node="node.upperBranch" :x="horizontalSpacing" :y="-getVerticalOffset" />
                            <line x1="0" :y1="-getVerticalOffset" :x2="horizontalSpacing" :y2="-getVerticalOffset" stroke="#333" stroke-width="2" />
                            <line :x1="node.upperBranch.countMaxLength() + horizontalSpacing" :y1="-getVerticalOffset" :x2="node.countLength()" :y2="-getVerticalOffset" stroke="#333" stroke-width="2" />
                        </template>
                    </template>
                    <template v-else>
                        <line x1="0" :y1="-getVerticalOffset" :x2="node.countLength()" :y2="-getVerticalOffset" stroke="#333" stroke-width="2" />
                        <!-- Empty upper branch drop zone — always visible -->
                        <rect
                          :x="node.countLength()/2 - 28" :y="-getVerticalOffset - 16"
                          width="56" height="32" rx="5"
                          :fill="emptyBranchHover === 'upper' ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.06)'"
                          :stroke="emptyBranchHover === 'upper' ? '#3b82f6' : '#aac4f0'"
                          stroke-width="1.5" stroke-dasharray="5,3"
                          @dragover.prevent
                          @dragenter.prevent="emptyBranchHover = 'upper'"
                          @dragleave="emptyBranchHover = null"
                          @drop.stop.prevent="onEmptyDrop($event, 'upper')"
                        />
                        <text
                          :x="node.countLength()/2" :y="-getVerticalOffset + 5"
                          text-anchor="middle" font-size="10"
                          :fill="emptyBranchHover === 'upper' ? '#3b82f6' : '#aac4f0'"
                          pointer-events="none"
                        >drop here</text>
                    </template>
                </g>

                <!-- Lower branch -->
                <g class="branchContainer">
                    <template v-if="node.lowerBranch">
                        <template v-if="(node.upperBranch?.countMaxLength() ?? nodeWidth - 1) > (node.lowerBranch?.countMaxLength() ?? nodeWidth - 1)">
                            <CircuitRenderer :node="node.lowerBranch" :x="(node.upperBranch?.countMaxLength() ?? nodeWidth - 1)/2-node.lowerBranch.countMaxLength()/2 + horizontalSpacing" :y="getVerticalOffset" />
                            <line x1="0" :y1="getVerticalOffset" :x2="(node.upperBranch?.countMaxLength() ?? nodeWidth - 1)/2-node.lowerBranch.countMaxLength()/2 + horizontalSpacing" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                            <line :x1="(node.upperBranch?.countMaxLength() ?? nodeWidth - 1)/2+node.lowerBranch.countMaxLength()/2 + horizontalSpacing" :y1="getVerticalOffset" :x2="node.countLength()" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                        </template>
                        <template v-else>
                            <CircuitRenderer :node="node.lowerBranch" :x="horizontalSpacing" :y="getVerticalOffset" />
                            <line x1="0" :y1="getVerticalOffset" :x2="horizontalSpacing" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                            <line :x1="node.lowerBranch.countMaxLength() + horizontalSpacing" :y1="getVerticalOffset" :x2="node.countLength()" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                        </template>
                    </template>
                    <template v-else>
                        <line x1="0" :y1="getVerticalOffset" :x2="node.countLength()" :y2="getVerticalOffset" stroke="#333" stroke-width="2" />
                        <!-- Empty lower branch drop zone — always visible -->
                        <rect
                          :x="node.countLength()/2 - 28" :y="getVerticalOffset - 16"
                          width="56" height="32" rx="5"
                          :fill="emptyBranchHover === 'lower' ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.06)'"
                          :stroke="emptyBranchHover === 'lower' ? '#3b82f6' : '#aac4f0'"
                          stroke-width="1.5" stroke-dasharray="5,3"
                          @dragover.prevent
                          @dragenter.prevent="emptyBranchHover = 'lower'"
                          @dragleave="emptyBranchHover = null"
                          @drop.stop.prevent="onEmptyDrop($event, 'lower')"
                        />
                        <text
                          :x="node.countLength()/2" :y="getVerticalOffset + 5"
                          text-anchor="middle" font-size="10"
                          :fill="emptyBranchHover === 'lower' ? '#3b82f6' : '#aac4f0'"
                          pointer-events="none"
                        >drop here</text>
                    </template>
                </g>
            </g>
        </template>

        <template v-if="node.next && node.type !== 'end' && node.next.type !== 'end'">
            <line
              :x1="['R','C','CPE','W','parallel'].includes(node.type) ? node.countLength() : node.countLength()+3"
              y1="0"
              :x2="node.countLength() + horizontalSpacing"
              y2="0"
              stroke="#333" stroke-width="2"
            />
            <CircuitRenderer :node="node.next" :x="node.countLength() + horizontalSpacing" :y="0" />
        </template>
    </g>
</template>

<style scoped>
.hover-box {
  fill: rgba(0, 0, 0, 0.04);
  stroke: rgba(0, 0, 0, 0.08);
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: all;
  cursor: pointer;
}

.component-wrapper:hover > .hover-box {
  opacity: 1;
}

.component-wrapper:has(.component-wrapper:hover) > .hover-box {
  opacity: 0 !important;
}
</style>
