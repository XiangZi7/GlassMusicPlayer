// 测试歌曲数据
import { Song } from '@/stores/interface'

export const testSongs: Song[] = [
  {
    id: 1,
    name: 'Intro AE 86',
    artist: '陈光荣',
    album: '頭文字[イニシャル]D THE MOVIE SOUND TUNE',
    duration: '04:12',
    url: 'http://music.163.com/song/media/outer/url?id=27591651.mp3',
    cover: 'http://p4.music.126.net/9KeyafHLjadqSQTRS_tN5Q==/5741649720318487.jpg',
    emoji: '🌟',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    liked: false
  },
  {
    id: 2,
    name: 'Ninelie',
    artist: 'Aimer',
    album: 'ninelie EP',
    duration: '03:34',
    url: 'http://music.163.com/song/media/outer/url?id=409872504.mp3',
    cover: 'http://p3.music.126.net/g7aakYG_Wfmrn1_IDfVUXA==/109951165050166241.jpg',
    emoji: '🎈',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    liked: true
  },
  {
    id: 3,
    name: '稻香',
    artist: '周杰伦',
    album: '魔杰座',
    duration: '03:43',
    url: 'https://www.soundjay.com/misc/sounds/magic-chime-02.mp3',
    cover: '',
    emoji: '🌾',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    liked: false
  },
  {
    id: 4,
    name: '青花瓷',
    artist: '周杰伦',
    album: '我很忙',
    duration: '03:58',
    url: 'https://www.soundjay.com/misc/sounds/beep-07a.mp3',
    cover: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&h=300&fit=crop',
    emoji: '🏺',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    liked: true
  },
  {
    id: 5,
    name: '演员',
    artist: '薛之谦',
    album: '绅士',
    duration: '04:20',
    url: 'https://www.soundjay.com/misc/sounds/beep-28.mp3',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&auto=format&q=80',
    emoji: '🎭',
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    liked: false
  }
]