<template>
	<label :class="['check-row', { 'check-row--disabled': disabled }]">
		<span class="check-row__copy">
			<strong>{{ title }}</strong>
			<small v-if="$slots.hint">
				<slot name="hint" />
			</small>
			<small v-else-if="hint">{{ hint }}</small>
		</span>
		<slot name="suffix">
			<div v-if="disabled" class="check-row__disabled-note">{{ disabledText }}</div>
			<input
				v-else
				:checked="modelValue"
				type="checkbox"
				@change="onChange"
			/>
		</slot>

		<!-- details slot: only render when default slot provided, and render inside the card under the checkbox -->
		<template v-if="$slots.default">
			<div class="check-row__details" :class="{ 'check-row__details--disabled': (!modelValue || disabled) }">
				<slot />
			</div>
		</template>
	</label>
</template>

<script setup lang="ts">
type Props = {
	title: string
	hint?: object | string
	modelValue?: boolean
	disabled?: boolean
	disabledText?: string
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: false,
	disabled: false,
	disabledText: '',
})

const emit = defineEmits<{
	'update:modelValue': [value: boolean]
}>()

function onChange(event: Event) {
	const target = event.target as HTMLInputElement | null
	emit('update:modelValue', Boolean(target?.checked))
}
</script>

<style scoped>
.check-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	gap: 1rem;
	padding: 0.9rem 1rem;
	border-radius: 10px;
	background: var(--component-bg-blur);
	border: 1px solid var(--border-color-blur);
}

.check-row input {
	width: 18px;
	height: 18px;
	accent-color: var(--accent);
	flex: 0 0 auto;
}

.check-row__copy {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
}

.check-row__copy strong {
	font-size: 0.98rem;
}

.check-row__copy small {
	color: var(--component-text-secondary);
	line-height: 1.4;
}

.check-row--disabled {
	opacity: 0.6;
	pointer-events: none;
}

.check-row__disabled-note {
	color: var(--component-text-secondary);
	font-size: 0.9rem;
}

.check-row__details {
	margin-top: 0.5rem;
	padding: 0 0.5rem 0.5rem 0.5rem;
	color: var(--component-text-primary);
}

.check-row--disabled .check-row__details {
	opacity: 0.6;
	pointer-events: none;
}

.check-row__details--disabled {
	opacity: 0.6;
	pointer-events: none;
}

@media (max-width: 400px) {
	.check-row {
		grid-template-columns: 1fr;
		align-items: start;
	}

	.check-row input {
		justify-self: start;
	}
}
</style>