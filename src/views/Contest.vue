<template>
  <div>
    <main v-if="contest">
      <h1>{{ contest.name }}<br />评委评分表</h1>
      <b-row>
        <b-col class="text-right">比赛日期：<u>{{ date.format('Y') }}</u>年<u>{{ date.format('M') }}</u>月<u>{{ date.format('D') }}</u>日</b-col>
      </b-row>
      <b-row>
        <b-col class="text-left">
          <b-form-group :label="contest.round ? '轮次：' : '所属分组：'">
            <b-form-radio-group v-model="group" :options="groups"></b-form-radio-group>
          </b-form-group>
        </b-col>
        <b-col v-if="judges" class="text-left">
          <b-form-group label="评委姓名：">
            <b-form-radio-group v-model="judge" :options="judges"></b-form-radio-group>
          </b-form-group>
        </b-col>
      </b-row>
      <b-table
        v-if="grouped"
        bordered
        :items="rowsPaged"
        :fields="cols"
        :tbody-tr-class="highlight"
        :sort-by.sync="sortBy"
        :sort-desc.sync="sortDesc"
        responsive="sm"
      >
        <template v-slot:cell(seq)="row">
          {{ row.value }}
          <button v-if="root && contest.round && group < contest.groups.length - 1" type="button" class="close" aria-label="Eliminate" @click="eliminate(row.item._id)">
            <span aria-hidden="true">&times;</span>
          </button>
        </template>
        <template v-for="col in scoreCols" v-slot:[`head(${col.key})`]>
          <div :key="col.key">
            {{ col.label }}
            <template v-if="col.max"><br />({{ col.max }}分)</template>
          </div>
        </template>
        <template v-for="col in scoreCols" v-slot:[`cell(${col.key})`]="row">
          <div :key="col.key">
            <span v-if="readonly">{{ typeof row.value === 'number' ? row.value.toFixed(2) : '-' }}</span>
            <input v-else class="text-right" type="number" inputmode="numeric" pattern="^\d+(\.[0-9]+)?$" :value="row.value" :min="col.min" :max="col.max" :step="col.step" @change="update($event, col, row.item._id)" @focus="$event.target.select()" />
          </div>
        </template>
        <template v-slot:cell(total)="row">
          <b>{{ typeof row.value === 'number' ? row.value.toFixed(2) : '-' }}</b>
        </template>
        <template v-slot:thead-top="data">
          <b-tr>
            <b-th variant="info" colspan="3">选手信息</b-th>
            <b-th v-if="contest.round" :colspan="contest.evaluations[group].items.length">{{ contest.evaluations[group].name }}</b-th>
            <b-th v-else v-for="(group, index) in contest.evaluations" :key="group._id" :variant="['primary', 'secondary'][index % 2]" :colspan="group.items.length">{{ group.name }}</b-th>
          </b-tr>
        </template>
      </b-table>
      <b-pagination
        v-if="grouped"
        v-model="page"
        :total-rows="virtualRowCount"
        :per-page="grouped.chunk"
        align="fill"
        size="sm"
        class="my-0"
      ></b-pagination>
      <ol class="text-left" v-if="contest">
        <li v-for="(rule, index) in contest.rules" :key="index">{{ rule }}</li>
      </ol>
      <b-row>
        <b-col v-if="root"><b-button variant="danger" @click="reset">清除分数</b-button></b-col>
        <b-col><b-button variant="warning" @click="reload">重新加载</b-button></b-col>
        <b-col><b-button variant="danger" @click="exit">切换评委</b-button></b-col>
      </b-row>
    </main>
    <template v-else>
      <h2>请认证</h2>
      <b-form @submit.prevent="auth">
        <b-form-group label="用户名：" label-for="username" description="主管：root 助理：guest">
          <b-form-input
            id="username"
            v-model="form.judge"
            type="text"
            required
            autocomplete="off"
          ></b-form-input>
        </b-form-group>
        <b-form-group label="密码：" label-for="password">
          <b-form-input
            id="password"
            type="password"
            v-model="form.password"
            autocomplete="off"
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
let highlightTick = 0
export default {
  name: 'Contest',
  data () {
    return {
      socket,
      user: null,
      judge: null, // NULL i.e averaged
      contest: null,
      scores: [],
      group: 0, // current group
      page: 1,
      sortBy: 'seq',
      sortDesc: false,
      form: { judge: this.$route.query.judge || '', password: '' }
    }
  },
  computed: {
    id () {
      return this.$route.params.id
    },
    root () {
      return isRoot(this.user)
    },
    readonly () {
      return isGuest(this.user) || this.judge === null || this.user !== this.judge
    },
    date () {
      if (!this.contest) return null
      return moment(this.contest.date)
    },
    judges () {
      if (!this.contest) return []
      return [{ text: '平均', value: null }, ...this.contest.judges.map((j) => {
        return { text: j.name, value: j._id }
      })]
    },
    groups () {
      if (!this.contest) return []
      return this.contest.groups.map((g, value) => {
        return { text: `${g.name}${this.contest.round ? '轮' : '组'}`, value }
      })
    },
    grouped () {
      if (!this.contest) return
      try {
        return this.contest.groups[this.group]
      } catch (e) {
        return null
      }
    },
    highlightEnabled () {
      return this.grouped && (this.grouped.head || this.grouped.tail)
    },
    virtualRowCount () {
      if (!this.contest) return 0
      return this.round ? this.contest.groups[0].candidates.length : this.grouped.candidates.length
    },
    scoreCols () {
      if (!this.contest) return []
      const columns = []
      this.iterateRound(group => {
        group.items.forEach(item => {
          columns.push({ key: item._id, label: item.name, sortable: true, min: item.min, max: item.max, step: item.step })
        })
      })
      return columns
    },
    cols () {
      if (!this.contest) return []
      const columns = [{ key: 'seq', label: '参赛号', sortable: true }, { key: 'name', label: '选手名' }, { key: 'nickname', label: '昵称' }]
      columns.push(...this.scoreCols)
      columns.push({ key: 'total', label: '总分', sortable: true })
      return columns
    },
    rows () {
      try {
        const candidates = this.grouped.candidates.map(candidate => {
          let hasTotal = 0
          this.iterateRound(e => {
            e.items.forEach(item => {
              if (this.judge) {
                const s = this.scores.find(s => s.judge === this.judge && s.candidate === candidate._id && s.evaluation === item._id)
                candidate[item._id] = s ? s.score : null
              } else {
                const s = this.scores.filter(s => s.candidate === candidate._id && s.evaluation === item._id)
                candidate[item._id] = s.length ? s.reduce((sum, s) => sum + s.score, 0) / s.length : null
              }
              if (candidate[item._id] === null) {
                hasTotal = false
              } else {
                if (hasTotal !== false) hasTotal += candidate[item._id]
              }
            })
          })
          candidate.total = hasTotal || null
          return candidate
        })
        return candidates
      } catch (e) {
        return []
      }
    },
    rowsPaged () {
      if (!this.grouped || !this.grouped.chunk) return this.rows
      return this.contest.round ? this.rows.filter(row => Math.ceil(row.seq / this.grouped.chunk) === this.page) : this.rows.slice(this.grouped.chunk * (this.page - 1), this.grouped.chunk * this.page)
    }
  },
  created () {
    const judge = localStorage.getItem('judge')
    if (this.$route.query.judge && this.$route.query.judge !== judge) return
    const password = localStorage.getItem('password')
    if (judge && password) {
      this.form.judge = judge
      this.form.password = password
      this.auth()
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
    iterateRound (fn) {
      this.contest.round && this.contest.evaluations[this.group] ? fn(this.contest.evaluations[this.group]) : this.contest.evaluations.forEach(fn)
    },
    parse (score) {
      if (!this.user) return
      const index = this.scores.findIndex(s => s.judge === score.judge && s.candidate === score.candidate && s.evaluation === score.evaluation)
      index === -1 ? this.scores.push(score) : this.$set(this.scores, index, score)
    },
    highlight (row) {
      if (this.highlightEnabled && row.total) {
        const rank = this.rowsPaged.filter(r => r.total && r.total > row.total).length + 1
        const { head, chunk, tail } = this.grouped
        if (head && rank <= head) return 'table-success'
        if (chunk && tail && rank > chunk - tail) return 'table-danger'
      }
      if (row.total) return 'table-warning'
      if (highlightTick++ % 2) return 'table-secondary'
    },
    auth () {
      this.socket.emit('auth', this.id, this.form.judge, this.form.password, resp => {
        if (!resp || !resp.judge || !resp.contest || resp.error) {
          return this.error(resp.error || '认证错误')
        }
        if (!this.user) this.socket.on('reconnect', this.auth) // keep auth if disconnected accidently
        localStorage.setItem('judge', this.form.judge)
        localStorage.setItem('password', this.form.password)
        this.user = resp.judge._id
        this.contest = resp.contest
        this.judge = this.contest.judges.find(j => j._id === this.user) ? this.user : this.contest.judges[0]._id
        this.scores = resp.scores
        this.socket.on('score', this.parse)
        this.socket.on('contest', contest => { this.contest = contest })
      })
    },
    update (ev, evaluation, candidate) {
      const score = parseFloat(ev.target.value)
      if (Number.isNaN(score)) {
        ev.target.value = ''
        return
      }
      if (score < evaluation.min) return this.errorInput(ev.target, '打分低于起始分')
      if (evaluation.max && score > evaluation.max) return this.errorInput(ev.target, '打分高于满分')
      if (evaluation.step && score % evaluation.step > 0.1) return this.errorInput(ev.target, '打分小数规则不满足')
      this.socket.emit('score', evaluation.key, candidate, score, resp => {
        if (resp.e) {
          this.errorInput(ev.target, '上传评分失败')
        } else if (resp.s) {
          this.parse(resp.s)
        }
      })
    },
    eliminate (candidate) {
      if (confirm('确认将选手排除出下一轮？')) {
        this.socket.emit('eliminate', this.group + 1, candidate, contest => {
          if (contest) this.contest = contest
        })
      }
    },
    reset () {
      if (confirm('确认清除？')) {
        this.socket.emit('reset', resp => {
          if (resp.c) {
            this.contest = resp.c
            this.scores = []
          }
        })
      }
    },
    reload () {
      this.socket.emit('scores', scores => {
        console.log(scores)
        this.scores = scores
      })
    },
    exit () {
      this.user = null
      this.judge = null
      this.contest = null
      this.scores = []
      this.group = 0
      this.page = 1
      this.form.judge = ''
      this.form.password = ''
      localStorage.removeItem('judge')
      localStorage.removeItem('password')
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
        margin: 0;
        padding: 0;
      }
      th, td{
        white-space: nowrap;
      }
    }
    & /deep/ ol {
      margin: 1em 0;
    }
  }
</style>
