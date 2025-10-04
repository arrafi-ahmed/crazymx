<script setup>
import { appInfo } from '@/others/util'
import { useStore } from 'vuex'

const store = useStore()
</script>
<template>
  <v-footer class="bg-tertiary flex-grow-0">
    <div class="footer-container">
      <v-row
        align="center"
        justify="center"
        no-gutters
      >
        <v-col
          class="text-center"
          cols="12"
        >
          <!-- Social Media Links -->
          <div class="mb-3">
            <v-btn
              class="mx-1"
              color="white"
              href="https://t.me/peaceismorg"
              icon
              size="small"
              target="_blank"
              variant="text"
            >
              <v-icon icon="fa:fab fa-telegram" />
            </v-btn>
            <v-btn
              class="mx-1"
              color="white"
              href="https://facebook.com/peaceismorg"
              icon
              size="small"
              target="_blank"
              variant="text"
            >
              <v-icon>mdi-facebook</v-icon>
            </v-btn>
            <v-btn
              class="mx-1"
              color="white"
              href="https://twitter.com/peaceismorg"
              icon
              size="small"
              target="_blank"
              variant="text"
            >
              <v-icon>mdi-twitter</v-icon>
            </v-btn>
            <v-btn
              class="mx-1"
              color="white"
              href="https://linkedin.com/company/peaceismorg"
              icon
              size="small"
              target="_blank"
              variant="text"
            >
              <v-icon>mdi-linkedin</v-icon>
            </v-btn>
            <v-btn
              class="mx-1"
              color="white"
              href="https://instagram.com/peaceismorg"
              icon
              size="small"
              target="_blank"
              variant="text"
            >
              <v-icon>mdi-instagram</v-icon>
            </v-btn>
          </div>

          <!-- Copyright -->
          <small class="text-white">
            &copy;
            <strong>{{ appInfo.name }}</strong>
            {{ new Date().getFullYear() }}
          </small>
        </v-col>
      </v-row>
    </div>
  </v-footer>
</template>

<style scoped>
.footer-container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
}
</style>
