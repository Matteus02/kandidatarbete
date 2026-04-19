<script setup lang="ts">
import { CircuitNode } from '@/components/circuit/CircuitNode'
import { computed } from 'vue'

const props = defineProps<{
    node: CircuitNode;
    x: number;
    y: number;
    amount: number;
}>()

const boxHeight = 30;
const boxWidth = 150;
const parallelTrue = computed(() =>{
    if(props.node.type === 'parallel'){
        return 0
    }
    return 1
})

const upperLength = computed(() => {
    if (props.node.type === 'parallel' && props.node.upperBranch) {
        return props.node.upperBranch.countAmount();
    }
    return 0;
})

const lowerLength = computed(() => {
    if (props.node.type === 'parallel' && props.node.lowerBranch) {
        return props.node.lowerBranch.countAmount();
    }
    return 0;
})

</script>

<template>
    <g :transform="`translate(${x}, ${y})`">
        
    
        <g v-if="node.type!=='parallel'" class="circuitValue">
            <rect :x="0" :y="0" :width="boxWidth" :height="boxHeight" fill="rgba(0,0,0,0.05)" stroke="#999" rx="4" />
            <text x="5" :y="boxHeight / 2 + 4" font-size="12" fill="#333">{{ node.id }}:</text>
            <line x1="40" y1="0" x2="40" :y2="boxHeight" stroke="#999" stroke-width="2" />
            <foreignObject :x="45" y="2" :width="boxWidth - 50" :height="boxHeight - 6">
                <input type="number" :value="node.value" style="width: 100%; height: 100%; border: none; outline: none; font-size: 12px; padding: 0 5px; border-radius: 3px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, sans-serif;" />
            </foreignObject>
            
            
        </g>

        <template v-if="node.type === 'parallel'">
            <template v-if="node.upperBranch && node.upperBranch.type !== 'end'">
                <CircuitValue :node="node.upperBranch" :x="0" :y="0" :amount="amount"/>
            </template>
            <template v-if="node.lowerBranch && node.lowerBranch.type !== 'end'">
                <CircuitValue :node="node.lowerBranch" :x="(boxWidth + 5)*upperLength%775" :y="0" :amount="amount+upperLength" />
            </template>
        </template>
        

        <template v-if="node.next && node.type !== 'end' && node.next.type !== 'end'">
            <CircuitValue :node="node.next" :x="(boxWidth + 5)*(upperLength + lowerLength + parallelTrue)%775" :y="0" :amount="amount + upperLength + lowerLength + parallelTrue"/>
        </template>
    </g>
</template>