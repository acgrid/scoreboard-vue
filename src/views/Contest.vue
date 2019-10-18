<template>
  <div>
    <main v-if="contest">
      <h1>{{ contest.name }}<br />评委评分表</h1>
      <b-row>
        <b-col class="text-right">比赛日期：<u>{{ date.format('Y') }}</u>年<u>{{ date.format('M') }}</u>月<u>{{ date.format('D') }}</u>日 <u>{{ date.format('H:mm') }}</u></b-col>
      </b-row>
      <b-row>
        <b-col class="text-left">
          <b-form-group label="轮次：">
            <b-form-radio-group v-model="phase" :options="phases"></b-form-radio-group>
          </b-form-group>
        </b-col>
        <b-col v-if="judges" class="text-left">
          <b-form-group label="评委：">
            <b-form-select v-model="judge" :options="judges" size="sm"></b-form-select>
          </b-form-group>
        </b-col>
      </b-row>
      <b-table
        v-if="rows"
        bordered
        :items="rows"
        :fields="cols"
        :tbody-tr-class="highlight"
        :sort-by.sync="sortBy"
        :sort-desc.sync="sortDesc"
        responsive="sm"
      >
        <template v-slot:cell(index)="data">
          {{ data.index + 1 }}
        </template>
        <template v-slot:cell(seq)="row">
          {{ row.value }}
          <button v-if="root && contest.round && group < contest.groups.length - 1" type="button" class="close" aria-label="Eliminate" @click="eliminate(row.item._id)">
            <span aria-hidden="true">&times;</span>
          </button>
        </template>
        <template v-for="col in scoreCols" v-slot:[`head(${col.key})`]>
          <div :key="col.key">
            {{ col.label }}
            <template v-if="col.value"><br />({{ col.value / contest.multiplier }}分)</template>
          </div>
        </template>
        <template v-for="col in scoreCols" v-slot:[`cell(${col.key})`]="row">
          <div :key="col.key" @click="focus(row)">{{ typeof row.value === 'number' ? (row.value / contest.multiplier).toFixed(2) : '-' }}</div>
        </template>
        <template v-slot:cell(total)="row">
          <b>{{ typeof row.value === 'number' ? (row.value / contest.multiplier).toFixed(2) : '-' }}</b>
        </template>
        <template v-slot:thead-top="data">
          <b-tr>
            <b-th></b-th>
            <b-th variant="info" colspan="3">选手信息</b-th>
            <b-th v-if="currentPhase" :colspan="currentPhase.items.length">{{ currentPhase.name }}评分</b-th>
            <b-th></b-th>
          </b-tr>
        </template>
      </b-table>
      <b-pagination
        v-if="rows"
        v-model="page"
        :total-rows="virtualRowCount"
        :per-page="Math.floor(virtualRowCount / contest.candidates.length)"
        align="fill"
        size="sm"
        class="my-0"
      ></b-pagination>
      <ol class="text-left" v-if="contest">
        <li v-for="(rule, index) in contest.rules" :key="index">{{ rule }}</li>
      </ol>
      <b-row>
        <b-col>连接状态：{{ online ? '在线' : '离线' }}</b-col>
        <b-col><b-button variant="warning" @click="reload">重新加载</b-button></b-col>
        <b-col><b-button variant="danger" @click="exit">切换评委</b-button></b-col>
      </b-row>
      <b-row v-if="root" style="margin-top: 1em">
        <b-col><b-form-file v-model="file" :state="Boolean(file)" browse-text="选择Excel文件" placeholder="导入选手名单并清除分数" drop-placeholder="可在此拖入文件..."></b-form-file></b-col>
        <b-col><b-button variant="danger" @click="reset">清除分数</b-button></b-col>
      </b-row>
      <VuePickerMobile v-if="!!(focusEvaluation || focusAdjust)" :show.sync="choosing" :list="pickerList" :defaultValue="pickerValue" @onChange="update"></VuePickerMobile>
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
import XLSX from 'xlsx'
import makeRange from 'loadsh/range'
import VuePickerMobile from 'vue-picker-mobile'
import socket from '../api/socket'
import { isRoot, isGuest, isJudge } from '../../lib/identity'
let highlightTick = 0
export default {
  name: 'Contest',
  components: { VuePickerMobile },
  data () {
    return {
      socket,
      online: false,
      user: null,
      judge: null, // NULL i.e averaged
      contest: null,
      scores: [],
      adjusts: [],
      phase: 0, // current evaluation group or -1 for overall
      page: 1, // current chunk
      sortBy: 'seq',
      sortDesc: false,
      form: { judge: this.$route.query.judge || '', password: '' },
      choosing: true,
      focusCandidate: null,
      focusEvaluation: null,
      focusAdjust: null,
      file: null
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
        return { text: j.name, value: j._id, disabled: isJudge(this.user) && j._id !== this.user }
      })]
    },
    phases () {
      if (!this.contest) return []
      return this.contest.evaluations.map((g, value) => {
        return { text: g.name, value }
      })
    },
    isSummary () {
      return this.phase === -1
    },
    currentPhase () {
      if (!this.contest || this.isSummary) return
      try {
        return this.contest.evaluations[this.phase]
      } catch (e) {
        console.error(e)
      }
    },
    highlightEnabled () {
      return this.currentPhase && (this.currentPhase.promote || this.currentPhase.eliminate)
    },
    virtualRowCount () {
      return this.contest ? this.contest.candidates.length : 0
    },
    scoreCols () {
      if (!this.contest) return []
      const columns = []
      this.currentPhase.items.forEach(item => {
        columns.push({ ...item, key: item._id, label: item.name, sortable: true })
      })
      return columns
    },
    cols () {
      if (!this.contest) return []
      const columns = [{ key: 'index', label: '行号' }, { key: 'seq', label: '参赛号', sortable: true }, { key: 'name', label: '选手名' }, { key: 'nickname', label: '昵称' }]
      columns.push(...this.scoreCols)
      columns.push({ key: 'total', label: '总分', sortable: true })
      return columns
    },
    rows () {
      if (!this.contest) return []
      try {
        const index = this.page - 1
        const candidates = this.contest.candidates[index].map(candidate => {
          let hasTotal = 0
          this.currentPhase.items.forEach(item => {
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
          candidate.total = hasTotal || null
          return candidate
        })
        return candidates
      } catch (e) {
        console.error(e)
        return []
      }
    },
    pickerList () {
      if (this.focusEvaluation) return this.focusEvaluation.choices.map(c => ({ label: `${c.name} (${(c.score / this.contest.multiplier).toFixed(1)})`, value: c.score }))
      if (this.focusAdjust) return makeRange(0, this.focusAdjust.repeat).map(x => (x * this.focusAdjust.single / this.contest.multiplier).toFixed(1))
      return [{ label: '', value: '' }]
    },
    pickerValue () {
      if (!this.focusCandidate) return
      if (this.focusEvaluation) return this.focusCandidate[this.focusEvaluation._id]
      if (this.focusAdjust) return this.focusCandidate[this.focusAdjust._id]
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
  watch: {
    file () {
      if (this.file) this.populate()
    }
  },
  methods: {
    error (msg, title = '错误') {
      this.$bvToast.toast(msg, { title, variant: 'danger', solid: true })
    },
    parse (score) {
      if (!this.user) return
      const index = this.scores.findIndex(s => s.judge === score.judge && s.candidate === score.candidate && s.evaluation === score.evaluation)
      index === -1 ? this.scores.push(score) : this.$set(this.scores, index, score)
    },
    highlight (row) {
      if (this.highlightEnabled && row.total) {
        const rank = this.rows.filter(r => r.total && r.total > row.total).length + 1
        const { promote, eliminate } = this.currentPhase
        if (promote && rank <= promote) return 'table-success'
        // if (eliminate && rank > chunk - eliminate) return 'table-danger'
      }
      if (row.total) return 'table-warning'
      if (highlightTick++ % 2) return 'table-secondary'
    },
    auth () {
      this.online = false
      this.socket.emit('auth', this.id, this.form.judge, this.form.password, resp => {
        console.log(resp)
        if (!resp || !resp.judge || !resp.contest || resp.error) {
          return this.error(resp.error || '认证错误')
        }
        if (!this.user) {
          this.socket.on('reconnect', this.auth) // keep auth if disconnected accidently
          this.socket.on('disconnect', () => {
            this.online = false
          })
        }
        this.online = true
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
    focus (row) {
      this[this.isSummary ? 'focusAdjust' : 'focusEvaluation'] = row.field
      this.focusCandidate = row.item
      this.choosing = true
    },
    update (res, type) {
      if (type === 'confirm') {
        this.socket.emit('score', this.focusEvaluation._id, this.focusCandidate._id, res[0].value, resp => {
          if (resp.e) {
            this.error('上传评分失败，请重试')
          } else if (resp.s) {
            this.focusCandidate = null
            this.focusEvaluation = null
            this.focusAdjust = null
            this.choosing = false
            this.parse(resp.s)
          }
        })
      }
    },
    eliminate (candidate) {
      if (confirm('确认将选手排除出下一轮？')) {
        this.socket.emit('eliminate', this.group + 1, candidate, contest => {
          if (contest) this.contest = contest
        })
      }
    },
    reset () {
      this.file = null
      this.populate()
    },
    populate () {
      const error = msg => {
        this.file = null
        this.error(msg)
      }
      const execute = groups => {
        if (confirm('该操作将清除全部已有的评分数据，是否确认？')) {
          this.socket.emit('populate', groups, resp => {
            if (resp.c) {
              this.$bvToast.toast('清除完毕', { title: '重置数据', variant: 'success', solid: true })
              this.contest = resp.c
              this.scores = []
              this.adjusts = []
            }
          })
        }
        this.file = null
      }
      const getCellValue = (sheet, column, row) => {
        const cell = sheet[`${column}${row + 1}`]
        return cell ? cell.w : null
      }
      if (this.file) {
        try {
          const reader = new FileReader()
          reader.onload = ev => {
            const workbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' })
            if (workbook.SheetNames.length !== 1) return error(`检测到Excel表格中有多个工作表，请删除多余的工作表再试一次。`)
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            const range = XLSX.utils.decode_range(sheet['!ref'])
            if (range.s.r === range.e.r) return error(`表格只有一行数据，请不要删除标题行`)
            const groups = []
            makeRange(range.s.r + 1, range.e.r + 1).forEach(row => {
              let group = getCellValue(sheet, 'A', row)
              if (Number.isNaN(group) || group <= 0) return
              group--
              const seq = getCellValue(sheet, 'B', row)
              const name = getCellValue(sheet, 'C', row)
              const nickname = getCellValue(sheet, 'D', row)
              if (!name || !nickname) return
              if (!groups[group]) groups[group] = []
              groups[group].push({ seq, name, nickname })
            })
            execute(groups)
          }
          reader.readAsArrayBuffer(this.file)
        } catch (e) {
          console.error(e)
          error(e)
        }
      } else {
        execute()
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
      th, td{
        white-space: nowrap;
      }
    }
    & /deep/ ol {
      margin: 1em 0;
    }
  }
</style>
