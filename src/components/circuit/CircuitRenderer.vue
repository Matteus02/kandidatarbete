<script setup lang="ts">
import { CircuitNode } from '@/components/circuit/CircuitNode'
import ResistorSymbol from './ResistorSymbol.vue'
import CapacitorSymbol from './CapacitorSymbol.vue'
import CpeSymbol from './CpeSymbol.vue'
import WarburgSymbol from './WarburgSymbol.vue'
import { ref, inject, computed } from 'vue'
import type { ElementType } from '@/components/circuit/CircuitNode'
import { get } from 'http'

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

const onDrop = (event: DragEvent, action: 'before' | 'replace' | 'after') => {
  hoverState.value = null;
  const type = event.dataTransfer?.getData('componentType');
  if (type && handleNodeDrop) {
    handleNodeDrop(props.node, type, action);
  }
}

const onEmptyDrop = (event: DragEvent, branch: 'upper' | 'lower') => {
  const type = event.dataTransfer?.getData('componentType');
  if (type && insertIntoEmptyBranch) {
    insertIntoEmptyBranch(props.node, branch, type);
  }
}

const deleteNode = inject<(n: CircuitNode) => void>('deleteNode')

const handleRemove = () => {
    console.log('Klickade på komponent:', props.node.id)
    if (deleteNode) {
        deleteNode(props.node);
    }
    else{
        console.error('Kunde inte hitta deleteNode-funktionen! Kolla provide/inject.')
    }
};

const nodeWidth = 60;
const nodeHeight = 38;
const parallelHeight = 21;
const horizontalSpacing = 30;


</script>

<template>
    <g :transform="`translate(${x}, ${y})`">
        <g v-if="['R', 'C', 'CPE', 'W'].includes(node.type)" class="component-wrapper" @click.stop="handleRemove" @dragleave.prevent="hoverState = null">

            
        
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

            <rect x="-20" y="-25" width="20" height="50" fill="transparent"
            @dragover.prevent @dragenter.prevent="hoverState = 'before'" @drop.stop.prevent="onDrop($event, 'before')" />
      
            <rect x="0" y="-25" width="60" height="50" fill="transparent"
                @dragover.prevent @dragenter.prevent="hoverState = 'replace'" @drop.stop.prevent="onDrop($event, 'replace')" />
                    
            <rect x="60" y="-25" width="20" height="50" fill="transparent"
                @dragover.prevent @dragenter.prevent="hoverState = 'after'" @drop.stop.prevent="onDrop($event, 'after')" />

                <rect x="0" y="-25" width="60" height="50" rx="4" class="hover-box" />
            <rect v-if="hoverState === 'before'" x="-25" y="-25" width="20" height="50" fill="rgba(0,0,0,0.2)" rx="4" pointer-events="none" />
            <rect v-if="hoverState === 'replace'" x="0" y="-25" width="60" height="50" fill="rgba(0,0,0,0.2)" rx="4" pointer-events="none" />
            <rect v-if="hoverState === 'after'" x="65" y="-25" width="20" height="50" fill="rgba(0,0,0,0.2)" rx="4" pointer-events="none" />

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

                <line 
                    x1="0" 
                    :y1="-getVerticalOffset" 
                    x2="0" 
                    :y2="getVerticalOffset" 
                    stroke="#333" stroke-width="2" 
                />

                <line 
                    :x1="node.countLength()" 
                    :y1="-getVerticalOffset" 
                    :x2="node.countLength()" 
                    :y2="getVerticalOffset" 
                    stroke="#333" stroke-width="2" 
                />

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
                        <rect :x="node.countLength()/2-20" :y="-getVerticalOffset-15" width="40" height="30" fill="rgba(0,0,0,0.05)" stroke="#999" stroke-dasharray="4"
                            @dragover.prevent @drop.stop.prevent="onEmptyDrop($event, 'upper')" />
                    </template>  
                </g>

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
                        <rect :x="node.countLength()/2-20" :y="getVerticalOffset-15" width="40" height="30" fill="rgba(0,0,0,0.05)" stroke="#999" stroke-dasharray="4"
                            @dragover.prevent @drop.stop.prevent="onEmptyDrop($event, 'lower')" />
                    </template>
                </g>
            </g>
        </template>

        <template v-if="node.next && node.type !== 'end' && node.next.type !== 'end'">
            <line v-if="node.type==='R' || node.type==='C' || node.type==='parallel'" 
                :x1="node.countLength()" y1="0" 
                :x2="node.countLength() + horizontalSpacing" y2="0" 
                stroke="#333" stroke-width="2" 
            />
            <line v-else
                :x1="node.countLength()+3" y1="0" 
                :x2="node.countLength() + horizontalSpacing" y2="0" 
                stroke="#333" stroke-width="2"  
            />
            
            <CircuitRenderer
                :node="node.next" 
                :x="node.countLength() + horizontalSpacing" 
                :y="0" 
            />
        </template>
    </g>

</template>

<style scoped>

.hover-box {
  fill: rgba(0, 0, 0, 0.05); 
  stroke: rgba(0, 0, 0, 0.1);
  opacity: 0;
  transition: opacity 0.2s ease;
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