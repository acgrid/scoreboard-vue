<template>
  <div>
    <main v-if="contest">
      <h1>{{ contest.name }}<br />评委评分表</h1>
      <b-row>
        <b-col class="text-right">比赛日期：<u>{{ date.format('Y') }}</u>年<u>{{ date.format('M') }}</u>月<u>{{ date.format('D') }}</u>日</b-col>
      </b-row>
      <b-row>
        <b-col class="text-left">
          <b-form-group label="所属分组：">
            <b-form-radio-group v-model="group" :options="groups"></b-form-radio-group>
          </b-form-group>
        </b-col>
        <b-col v-if="judge" class="text-left">
          <b-form-group label="评委姓名：">
            <b-form-radio-group v-model="judge" :options="judges"></b-form-radio-group>
          </b-form-group>
        </b-col>
      </b-row>
      <b-table
        v-if="grouped"
        bordered
        striped
        :items="rows"
        :fields="cols"
        :current-page="page"
        :per-page="grouped.chunk"
        responsive="sm"
      >
        <template v-for="col in scoreCols" v-slot:[`cell(${col.key})`]="row">
          <span v-if="readonly">{{ row.value }}</span>
          <input v-else :key="col.key" class="text-right" type="number" pattern="[0-9]+(\.[0-9]+)?" :value="row.value" :min="col.min" :max="col.max" :step="col.step" @change="update($event, col, row.item._id)" />
        </template>
        <template v-slot:thead-top="data">
          <b-tr>
            <b-th variant="info" colspan="3">选手信息</b-th>
            <b-th v-for="(group, index) in contest.evaluations" :key="group._id" :variant="['primary', 'secondary'][index % 2]" :colspan="group.items.length">{{ group.name }}</b-th>
          </b-tr>
        </template>
      </b-table>
      <b-pagination
        v-if="grouped"
        v-model="page"
        :total-rows="grouped.candidates.length"
        :per-page="grouped.chunk"
        align="fill"
        size="sm"
        class="my-0"
      ></b-pagination>
      <ol class="text-left" v-if="contest">
        <li v-for="(rule, index) in contest.rules" :key="index">{{ rule }}</li>
      </ol>
    </main>
    <template v-else>
      <h2>请认证</h2>
      <b-form @submit.prevent="auth">
        <b-form-group label="用户名：" label-for="username" description="书记员请用guest登录">
          <b-form-input
            id="username"
            v-model="form.judge"
            type="text"
            required
          ></b-form-input>
        </b-form-group>
        <b-form-group label="密码：" label-for="password">
          <b-form-input
            id="password"
            type="password"
            v-model="form.password"
            required
          ></b-form-input>
        </b-form-group>
        <b-button type="submit" variant="primary">认证</b-button>
      </b-form>
    </template>
  </div>
</template>
<script>
import moment from 'moment'
import socket from '../api/socket'
import { isRoot, isGuest } from '../../lib/identity'
export default {
  name: 'Contest',
  data () {
    return {
      socket,
      user: null,
      judge: null,
      contest: null,
      scores: [],
      averaged: false, // TRUE for all
      group: 0, // current group
      page: 1,
      form: { judge: '', password: '' }
    }
  },
  computed: {
    id () {
      return this.$route.params.id
    },
    readonly () {
      return (isGuest(this.user) || this.user !== this.judge) && !isRoot(this.user)
    },
    date () {
      if (!this.contest) return null
      return moment(this.contest.date)
    },
    judges () {
      if (!this.contest) return []
      return this.contest.judges.map((j) => {
        return { text: j.name, value: j._id }
      })
    },
    groups () {
      if (!this.contest) return []
      return this.contest.groups.map((g, value) => {
        return { text: `${g.name}组`, value }
      })
    },
    grouped () {
      if (!this.contest) return
      try {
        return this.contest.groups[this.group]
      } catch (e) {
        console.warn(e)
        return null
      }
    },
    scoreCols () {
      const columns = []
      this.contest.evaluations.forEach(group => {
        group.items.forEach(item => {
          columns.push({ key: item._id, label: item.name, min: item.min, max: item.max, step: item.step })
        })
      })
      return columns
    },
    cols () {
      const columns = [{ key: 'seq', label: '参赛号'}, { key: 'name', label: '选手名'}, { key: 'nickname', label: '昵称'}]
      columns.push(...this.scoreCols)
      columns.push({ key: 'total', label: '总分' })
      return columns
    },
    rows () {
      try {
        const candidates = this.grouped.candidates.map(candidate => {
          candidate.total = 0
          this.contest.evaluations.forEach(e => {
            e.items.forEach(item => {
              const s = this.scores.find(s => s.judge === this.judge && s.candidate === candidate._id && s.evaluation === item._id)
              candidate[item._id] = s ? s.score : null
              if (s) candidate.total += s.score
            })
          })
          return candidate
        })
        return candidates
        // return group.chunk ? chunk(candidates, group.chunk) : [candidates]
      } catch (e) {
        return []
      }
    }
  },
  methods: {
    error (msg, title = '错误') {
      this.$bvToast.toast(msg, { title, variant: 'danger', solid: true })
    },
    errorInput (input, msg) {
      input.value = ''
      this.error(msg, '分数问题')
    },
    parse (score) {
      const index = this.scores.findIndex(s => s.judge === score.judge && s.candidate === score.candidate && s.evaluation === score.evaluation)
      console.log('got score', index, score)
      index === -1 ? this.scores.push(score) : this.$set(this.scores, index, score)
    },
    auth () {
      this.socket.emit('auth', this.id, this.form.judge, this.form.password, resp => {
        if (!resp || !resp.judge || !resp.contest || resp.error) {
          return this.error(resp.error || '认证错误')
        }
        if (!this.user) this.socket.on('reconnect', this.auth) // keep auth if disconnected accidently
        this.user = resp.judge._id
        this.contest = resp.contest
        this.judge = this.contest.judges.find(j => j._id === this.user) ? this.user : this.contest.judges[0]._id
        this.scores = resp.scores
        this.socket.on('score', this.parse)
      })
    },
    update (ev, evaluation, candidate) {
      const score = parseFloat(ev.target.value)
      if (score < evaluation.min) return this.errorInput(ev.target, '打分低于起始分')
      if (evaluation.max && score > evaluation.max) return this.errorInput(ev.target, '打分高于满分')
      if (evaluation.step && score % evaluation.step > 0.1) return this.errorInput(ev.target, '打分小数规则不满足')
      this.socket.emit('score', evaluation.key, candidate, score, resp => {
        if (resp.e) {
          console.error(resp.e)
          this.errorInput(ev.target, '上传评分失败')
        } else if (resp.s) {
          this.parse(resp.s)
        }
      })
    }
  },
  metaInfo: {
    title: '评分表'
  }
}
</script>
<style lang="less" scoped>
  main {
    text-align: center;
    & /deep/ table {
      margin-top: 1em;
      input[type=number]{
        width: 4em;
      }
    }
    & /deep/ ol {
      margin: 1em 0;
    }
  }
</style>
