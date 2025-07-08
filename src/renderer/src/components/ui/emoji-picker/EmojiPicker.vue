<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

// Import our custom tabs components
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '../tabs'

const { t } = useI18n()

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Emoji categories
const categories = [
  { id: 'smileys', name: t('components.emojiPicker.smileys', 'Smileys & Emotion'), icon: '😀' },
  { id: 'people', name: t('components.emojiPicker.people', 'People & Body'), icon: '👨' },
  { id: 'animals', name: t('components.emojiPicker.animals', 'Animals & Nature'), icon: '🐶' },
  { id: 'food', name: t('components.emojiPicker.food', 'Food & Drink'), icon: '🍔' },
  { id: 'travel', name: t('components.emojiPicker.travel', 'Travel & Places'), icon: '✈️' },
  { id: 'activities', name: t('components.emojiPicker.activities', 'Activities'), icon: '⚽' },
  { id: 'objects', name: t('components.emojiPicker.objects', 'Objects'), icon: '💡' },
  { id: 'symbols', name: t('components.emojiPicker.symbols', 'Symbols'), icon: '❤️' }
]

// Emoji data by category
const emojiData = {
  smileys: [
    '😀',
    '😃',
    '😄',
    '😁',
    '😆',
    '😅',
    '😂',
    '🤣',
    '😊',
    '😇',
    '🙂',
    '🙃',
    '😉',
    '😌',
    '😍',
    '🥰',
    '😘',
    '😗',
    '😙',
    '😚',
    '😋',
    '😛',
    '😝',
    '😜',
    '🤪',
    '🤨',
    '🧐',
    '🤓',
    '😎',
    '🤩',
    '🥳',
    '😏',
    '😒',
    '😞',
    '😔',
    '😟',
    '😕',
    '🙁',
    '☹️',
    '😣',
    '😖',
    '😫',
    '😩',
    '🥺',
    '😢',
    '😭',
    '😤',
    '😠',
    '😡',
    '🤬',
    '🤯'
  ],
  people: [
    '👋',
    '🤚',
    '✋',
    '🖐️',
    '👌',
    '🤏',
    '✌️',
    '🤞',
    '🤟',
    '🤘',
    '🤙',
    '👈',
    '👉',
    '👆',
    '🖕',
    '👇',
    '☝️',
    '👍',
    '👎',
    '✊',
    '👊',
    '🤛',
    '🤜',
    '👏',
    '🙌',
    '👐',
    '🤲',
    '🤝',
    '🙏',
    '✍️',
    '💅',
    '🤳',
    '💪',
    '🦾',
    '🦿',
    '🦵',
    '🦶',
    '👂',
    '🦻',
    '👃',
    '🧠',
    '🦷',
    '🦴',
    '👀',
    '👁️',
    '👅',
    '👄',
    '💋',
    '🩸'
  ],
  animals: [
    '🐶',
    '🐱',
    '🐭',
    '🐹',
    '🐰',
    '🦊',
    '🐻',
    '🐼',
    '🐨',
    '🐯',
    '🦁',
    '🐮',
    '🐷',
    '🐽',
    '🐸',
    '🐵',
    '🙈',
    '🙉',
    '🙊',
    '🐒',
    '🐔',
    '🐧',
    '🐦',
    '🐤',
    '🐣',
    '🐥',
    '🦆',
    '🦅',
    '🦉',
    '🦇',
    '🐺',
    '🐗',
    '🐴',
    '🦄',
    '🐝',
    '🐛',
    '🦋',
    '🐌',
    '🐞',
    '🐜',
    '🦟',
    '🦗',
    '🕷️',
    '🕸️',
    '🦂',
    '🦠'
  ],
  food: [
    '🍏',
    '🍎',
    '🍐',
    '🍊',
    '🍋',
    '🍌',
    '🍉',
    '🍇',
    '🍓',
    '🍈',
    '🍒',
    '🍑',
    '🥭',
    '🍍',
    '🥥',
    '🥝',
    '🍅',
    '🍆',
    '🥑',
    '🥦',
    '🥬',
    '🥒',
    '🌶️',
    '🌽',
    '🥕',
    '🧄',
    '🧅',
    '🥔',
    '🍠',
    '🥐',
    '🥯',
    '🍞',
    '🥖',
    '🥨',
    '🧀',
    '🥚',
    '🍳',
    '🧈',
    '🥞',
    '🧇',
    '🥓',
    '🥩',
    '🍗',
    '🍖',
    '🦴',
    '🌭'
  ],
  travel: [
    '🚗',
    '🚕',
    '🚙',
    '🚌',
    '🚎',
    '🏎️',
    '🚓',
    '🚑',
    '🚒',
    '🚐',
    '🚚',
    '🚛',
    '🚜',
    '🦯',
    '🦽',
    '🦼',
    '🛴',
    '🚲',
    '🛵',
    '🏍️',
    '🛺',
    '🚨',
    '🚔',
    '🚍',
    '🚘',
    '🚖',
    '🚡',
    '🚠',
    '🚟',
    '🚃',
    '🚋',
    '🚞',
    '🚝',
    '🚄',
    '🚅',
    '🚈',
    '🚂',
    '🚆',
    '🚇',
    '🚊',
    '🚉',
    '✈️',
    '🛫',
    '🛬',
    '🛩️',
    '💺'
  ],
  activities: [
    '⚽',
    '🏀',
    '🏈',
    '⚾',
    '🥎',
    '🎾',
    '🏐',
    '🏉',
    '🥏',
    '🎱',
    '🪀',
    '🏓',
    '🏸',
    '🏒',
    '🏑',
    '🥍',
    '🏏',
    '🥅',
    '⛳',
    '🪁',
    '🏹',
    '🎣',
    '🤿',
    '🥊',
    '🥋',
    '🎽',
    '🛹',
    '🛼',
    '🛷',
    '⛸️',
    '🥌',
    '🎿',
    '⛷️',
    '🏂',
    '🪂',
    '🏋️',
    '🤼',
    '🤸',
    '🤽',
    '🤾',
    '🤺',
    '🏊',
    '🏄',
    '🧘'
  ],
  objects: [
    '⌚',
    '📱',
    '📲',
    '💻',
    '⌨️',
    '🖥️',
    '🖨️',
    '🖱️',
    '🖲️',
    '🕹️',
    '🗜️',
    '💽',
    '💾',
    '💿',
    '📀',
    '📼',
    '📷',
    '📸',
    '📹',
    '🎥',
    '📽️',
    '🎞️',
    '📞',
    '☎️',
    '📟',
    '📠',
    '📺',
    '📻',
    '🎙️',
    '🎚️',
    '🎛️',
    '🧭',
    '⏱️',
    '⏲️',
    '⏰',
    '🕰️',
    '⌛',
    '⏳',
    '📡',
    '🔋',
    '🔌',
    '💡',
    '🔦',
    '🕯️'
  ],
  symbols: [
    '❤️',
    '🧡',
    '💛',
    '💚',
    '💙',
    '💜',
    '🖤',
    '🤍',
    '🤎',
    '💔',
    '❣️',
    '💕',
    '💞',
    '💓',
    '💗',
    '💖',
    '💘',
    '💝',
    '💟',
    '☮️',
    '✝️',
    '☪️',
    '🕉️',
    '☸️',
    '✡️',
    '🔯',
    '🕎',
    '☯️',
    '☦️',
    '🛐',
    '⛎',
    '♈',
    '♉',
    '♊',
    '♋',
    '♌',
    '♍',
    '♎',
    '♏',
    '♐',
    '♑',
    '♒',
    '♓',
    '🆔',
    '⚛️'
  ]
}

const searchQuery = ref('')
const isOpen = ref(false)
const selectedTab = ref(0)

// Filtered emojis based on search query
const filteredEmojis = computed(() => {
  if (!searchQuery.value) {
    return emojiData
  }

  const query = searchQuery.value.toLowerCase()
  const result: Record<string, string[]> = {}

  for (const [category, emojis] of Object.entries(emojiData)) {
    result[category] = emojis.filter((emoji) => {
      return emoji.toLowerCase().includes(query)
    })
  }

  return result
})

// Handle emoji selection
const selectEmoji = (emoji: string) => {
  emit('update:modelValue', emoji)
  isOpen.value = false
}
</script>

<template>
  <DropdownMenu v-model:open="isOpen">
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon" class="w-10 flex items-center justify-center text-sm">
        {{ modelValue || '📁' }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-80 p-0">
      <div class="p-2">
        <TabGroup v-model="selectedTab">
          <TabList class="flex overflow-x-auto w-full justify-between">
            <Tab
              v-for="(category, index) in categories"
              :key="category.id"
              :value="index"
              class="w-0 flex-grow py-1 cursor-pointer border-b-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              :class="{ 'border-b-2 border-primary': selectedTab === index }"
              :title="category.name"
            >
              {{ category.icon }}
            </Tab>
          </TabList>
          <TabPanels class="mt-2">
            <TabPanel
              v-for="(category, index) in categories"
              :key="category.id"
              :value="index"
              class="focus:outline-none"
            >
              <ScrollArea class="h-40">
                <div class="grid grid-cols-8 gap-1">
                  <Button
                    v-for="emoji in filteredEmojis[category.id]"
                    :key="emoji"
                    variant="ghost"
                    class="p-1 h-8 w-8 flex items-center justify-center"
                    @click="selectEmoji(emoji)"
                  >
                    {{ emoji }}
                  </Button>
                </div>
              </ScrollArea>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
