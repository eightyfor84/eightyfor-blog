<template>
    <div class="quarter-circle-spinner" :style="spinnerStyle">
        <svg :width="size" :height="size" viewBox="0 0 50 50">
            <path class="quarter-circle-path" d="M 25 5 A 20 20 0 0 1 45 25" fill="none" :stroke="color"
                :stroke-width="strokeWidth" stroke-linecap="round" />
        </svg>
    </div>
</template>

<script setup lang="ts">
interface Props {
    size?: string | number
    color?: string
    strokeWidth?: string | number
}

const props = withDefaults(defineProps<Props>(), {
    size: 24,
    color: 'currentColor',
    strokeWidth: 4
})

const spinnerStyle = {
    width: typeof props.size === 'number' ? `${props.size}px` : props.size,
    height: typeof props.size === 'number' ? `${props.size}px` : props.size
}
</script>

<style scoped>
.quarter-circle-spinner {
    display: inline-block;
    animation: rotate 1s linear infinite;
}

.quarter-circle-path {
    transform-origin: 25px 25px;
}

@keyframes rotate {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}
</style>